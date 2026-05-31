// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { IAavePool, IPick5PoolFactory } from "./Pick5Pool.sol";

/// @title OnzePool — an XI (11-player) seeded fantasy pool for the Onze World-Cup edition.
/// @dev Identical to Pick5Pool except the lineup is 11 ids and a captain id is stored.
/// The captain's points are doubled OFF-CHAIN by the oracle before submitScores; on-chain
/// the captain is store-only (verifiable). All seed/score/finalize/claim/withdraw/emergency/
/// Aave logic is unchanged from Pick5Pool.
contract OnzePool is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    address   public factory;       // source of the (rotatable) oracle
    IERC20    public usdt;
    IAavePool public aavePool;
    IERC20    public aUsdt;
    uint256   public lockTime;
    uint256   public endTime;
    uint256   public deposit;       // per-tournament entry fee
    uint256   public tournamentId;
    string    public label;

    uint256 public constant MAX_PARTICIPANTS = 500;
    uint256 public constant EMERGENCY_DELAY = 30 days;
    uint256 public constant ADMIN_EMERGENCY_DELAY = 60 days;

    uint256 public seedAmount;

    mapping(address => uint16[11]) private _lineups;
    mapping(address => uint16)     public captainOf;   // store-only; oracle doubles off-chain
    mapping(address => bool)       public hasJoined;
    address[] public participants;

    event Seeded(uint256 amount);
    event Joined(address indexed user, uint16[11] lineup, uint16 captainId, uint256 participantIndex);

    error BadTimes();
    error AlreadySeeded();
    error AlreadyJoined();
    error TournamentLocked();
    error InvalidLineup();
    error InvalidCaptain();
    error ZeroAmount();
    error PoolFull();

    /// @dev The implementation is never used directly — only cloned + initialized
    /// by the factory. Lock it so the implementation itself can't be initialized.
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _factory,
        address _owner,
        IERC20 _usdt,
        IAavePool _aavePool,
        IERC20 _aUsdt,
        uint256 _lockTime,
        uint256 _endTime,
        uint256 _deposit,
        uint256 _tournamentId,
        string calldata _label
    ) external initializer {
        if (_lockTime >= _endTime) revert BadTimes();
        if (_deposit == 0) revert ZeroAmount();
        __Ownable_init(_owner);
        __Pausable_init();
        factory = _factory;
        usdt = _usdt;
        aavePool = _aavePool;
        aUsdt = _aUsdt;
        lockTime = _lockTime;
        endTime = _endTime;
        deposit = _deposit;
        tournamentId = _tournamentId;
        label = _label;
    }

    /// @notice Oracle is read from the factory at call time so it can be rotated
    /// between tournaments without redeploying or touching live pools.
    function oracle() public view returns (address) {
        return IPick5PoolFactory(factory).oracle();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function seedPool(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (seedAmount > 0) revert AlreadySeeded();
        seedAmount = amount;
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        usdt.forceApprove(address(aavePool), amount);
        aavePool.supply(address(usdt), amount, address(this), 0);
        emit Seeded(amount);
    }

    function joinTournament(uint16[11] calldata lineup, uint16 captainId) external nonReentrant whenNotPaused {
        if (block.timestamp >= lockTime) revert TournamentLocked();
        if (hasJoined[msg.sender]) revert AlreadyJoined();
        if (participants.length >= MAX_PARTICIPANTS) revert PoolFull();
        _validateLineup(lineup);
        if (!_inLineup(lineup, captainId)) revert InvalidCaptain();

        hasJoined[msg.sender] = true;
        _lineups[msg.sender] = lineup;
        captainOf[msg.sender] = captainId;
        uint256 idx = participants.length;
        participants.push(msg.sender);

        usdt.safeTransferFrom(msg.sender, address(this), deposit);
        usdt.forceApprove(address(aavePool), deposit);
        aavePool.supply(address(usdt), deposit, address(this), 0);

        emit Joined(msg.sender, lineup, captainId, idx);
    }

    mapping(address => uint128) public scores;
    bool    public scoresSubmitted;
    address public winner;
    uint128 public winningScore;

    event ScoresSubmitted(address indexed winner, uint128 winningScore);
    event TieBreak(address[] tied, address winner, uint256 seed);

    error NotOracle();
    error TournamentNotEnded();
    error AlreadySubmitted();
    error LengthMismatch();
    error NoParticipants();
    error UserMismatch();

    function submitScores(
        address[] calldata users,
        uint128[]  calldata points,
        uint256    randomSeed
    ) external {
        if (msg.sender != IPick5PoolFactory(factory).oracle()) revert NotOracle();
        if (emergencyActive) revert EmergencyActiveErr();
        if (block.timestamp < endTime) revert TournamentNotEnded();
        if (scoresSubmitted) revert AlreadySubmitted();
        if (users.length != points.length) revert LengthMismatch();
        if (users.length != participants.length) revert LengthMismatch();
        if (users.length == 0) revert NoParticipants();

        uint128 maxScore;
        uint256 tieCount;
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] != participants[i]) revert UserMismatch();
            scores[users[i]] = points[i];
            if (points[i] > maxScore) {
                maxScore = points[i];
                tieCount = 1;
            } else if (points[i] == maxScore) {
                tieCount++;
            }
        }

        address[] memory tied = new address[](tieCount);
        uint256 ti;
        for (uint256 i = 0; i < users.length; i++) {
            if (points[i] == maxScore) {
                tied[ti++] = users[i];
            }
        }

        address w;
        if (tied.length == 1) {
            w = tied[0];
        } else {
            uint256 idx = uint256(keccak256(abi.encode(
                randomSeed, blockhash(block.number - 1), tied.length
            ))) % tied.length;
            w = tied[idx];
            emit TieBreak(tied, w, randomSeed);
        }

        winner = w;
        winningScore = maxScore;
        scoresSubmitted = true;
        emit ScoresSubmitted(w, maxScore);
    }

    bool    public finalized;
    uint128 public prizeAmount;
    mapping(address => bool) public depositWithdrawn;
    bool    public prizeClaimed;

    event Finalized(uint256 prizeAmount, uint256 yieldEarned);
    event DepositWithdrawn(address indexed user, uint256 amount);
    event PrizeClaimed(address indexed winner, uint256 amount);

    error ScoresNotSubmitted();
    error AlreadyFinalized();
    error AlreadyWithdrawn();
    error AlreadyClaimed();
    error NotWinner();
    error NotJoined();

    function finalizeAndDistribute() external nonReentrant {
        if (emergencyActive) revert EmergencyActiveErr();
        if (!scoresSubmitted) revert ScoresNotSubmitted();
        if (finalized) revert AlreadyFinalized();

        finalized = true;

        uint256 aBal = aUsdt.balanceOf(address(this));
        aavePool.withdraw(address(usdt), aBal, address(this));

        uint256 totalDeposits = deposit * participants.length;
        uint256 contractBal = usdt.balanceOf(address(this));
        uint256 prize = contractBal - totalDeposits;

        prizeAmount = uint128(prize);
        uint256 yieldEarned = prize > seedAmount ? prize - seedAmount : 0;
        emit Finalized(prize, yieldEarned);
    }

    function withdrawDeposit() external nonReentrant {
        if (!finalized) revert ScoresNotSubmitted();
        if (!hasJoined[msg.sender]) revert NotJoined();
        if (depositWithdrawn[msg.sender]) revert AlreadyWithdrawn();
        depositWithdrawn[msg.sender] = true;
        usdt.safeTransfer(msg.sender, deposit);
        emit DepositWithdrawn(msg.sender, deposit);
    }

    function claimPrize() external nonReentrant {
        if (emergencyActive) revert EmergencyActiveErr();
        if (!finalized) revert ScoresNotSubmitted();
        if (msg.sender != winner) revert NotWinner();
        if (prizeClaimed) revert AlreadyClaimed();
        prizeClaimed = true;
        usdt.safeTransfer(winner, prizeAmount);
        emit PrizeClaimed(winner, prizeAmount);
    }

    // ------------------------------------------------------------------ //
    // Emergency path — used when the oracle never submits scores.        //
    // ------------------------------------------------------------------ //

    bool public emergencyActive;
    mapping(address => bool) public emergencyWithdrawn;

    event EmergencyTriggered(address indexed by, uint256 timestamp);
    event EmergencyUserWithdrawn(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed admin, uint256 amount);

    error EmergencyAlreadyActive();
    error EmergencyNotElapsed();
    error EmergencyActiveErr();
    error EmergencyNotActive();
    error AlreadyEmergencyWithdrawn();
    error HasParticipants();
    error TooEarly();

    function triggerEmergency() external nonReentrant {
        if (emergencyActive) revert EmergencyAlreadyActive();
        if (block.timestamp < endTime + EMERGENCY_DELAY) revert EmergencyNotElapsed();
        if (scoresSubmitted) revert AlreadySubmitted();
        emergencyActive = true;
        uint256 aBal = aUsdt.balanceOf(address(this));
        if (aBal > 0) {
            aavePool.withdraw(address(usdt), aBal, address(this));
        }
        emit EmergencyTriggered(msg.sender, block.timestamp);
    }

    function emergencyUserWithdraw() external nonReentrant {
        if (!emergencyActive) revert EmergencyNotActive();
        if (!hasJoined[msg.sender]) revert NotJoined();
        if (emergencyWithdrawn[msg.sender]) revert AlreadyEmergencyWithdrawn();
        emergencyWithdrawn[msg.sender] = true;
        usdt.safeTransfer(msg.sender, deposit);
        emit EmergencyUserWithdrawn(msg.sender, deposit);
    }

    function emergencyAdminWithdraw() external onlyOwner nonReentrant {
        bool emergencyOwnerWindow =
            emergencyActive && block.timestamp >= endTime + ADMIN_EMERGENCY_DELAY;
        if (!emergencyOwnerWindow) {
            if (block.timestamp < endTime + 7 days) revert TooEarly();
            if (participants.length > 0) revert HasParticipants();
        }

        if (!emergencyActive) {
            uint256 aBal = aUsdt.balanceOf(address(this));
            if (aBal > 0) {
                aavePool.withdraw(address(usdt), aBal, address(this));
            }
        }
        uint256 bal = usdt.balanceOf(address(this));
        usdt.safeTransfer(owner(), bal);
        emit EmergencyWithdraw(owner(), bal);
    }

    function getLineup(address user) external view returns (uint16[11] memory) {
        return _lineups[user];
    }

    function participantsLength() external view returns (uint256) {
        return participants.length;
    }

    /// @dev Any non-zero, distinct uint16 id is valid (the off-chain scorer maps it to a
    /// player; an out-of-universe id simply scores 0). 11 ids for a full XI.
    function _validateLineup(uint16[11] calldata lineup) private pure {
        for (uint8 i = 0; i < 11; i++) {
            if (lineup[i] == 0) revert InvalidLineup();
            for (uint8 j = i + 1; j < 11; j++) {
                if (lineup[i] == lineup[j]) revert InvalidLineup();
            }
        }
    }

    /// @dev The captain must be one of the 11 picked ids (0 can never match — all ids non-zero).
    function _inLineup(uint16[11] calldata lineup, uint16 id) private pure returns (bool) {
        for (uint8 i = 0; i < 11; i++) {
            if (lineup[i] == id) return true;
        }
        return false;
    }
}
