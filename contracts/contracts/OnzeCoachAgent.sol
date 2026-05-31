// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title OnzeCoachAgent — commits + reveals an 11-player XI per round.
/// @dev Same commit-reveal design as CoachAgent (the Premier coach #9056), widened from
/// 5 to 11 picks for the Onze World-Cup edition. A NEW contract ⇒ a NEW ERC-8004 identity;
/// CoachAgent (#9056) is left intact as the historical Premier coach.
contract OnzeCoachAgent {
    address public immutable coachWallet;

    mapping(uint8 => bytes32) public commitments;
    mapping(uint8 => bool) private _hasCommitted;
    mapping(uint8 => uint16[11]) private _revealed;
    mapping(uint8 => uint8) public accuracy;
    mapping(uint8 => bool) private _hasRevealed;

    event PicksCommitted(uint8 indexed mw, bytes32 hash, uint256 timestamp);
    event PicksRevealed(uint8 indexed mw, uint16[11] picks, uint8 accuracy);

    error NotCoach();
    error AlreadyCommitted();
    error NotCommitted();
    error AlreadyRevealed();
    error HashMismatch();
    error InvalidAccuracy();

    constructor(address _coach) {
        require(_coach != address(0), "zero coach");
        coachWallet = _coach;
    }

    modifier onlyCoach() {
        if (msg.sender != coachWallet) revert NotCoach();
        _;
    }

    function publishCommitment(uint8 mw, bytes32 hash) external onlyCoach {
        if (_hasCommitted[mw]) revert AlreadyCommitted();
        commitments[mw] = hash;
        _hasCommitted[mw] = true;
        emit PicksCommitted(mw, hash, block.timestamp);
    }

    function revealPicks(uint8 mw, uint16[11] calldata picks, uint8 _accuracy) external onlyCoach {
        if (!_hasCommitted[mw]) revert NotCommitted();
        if (_hasRevealed[mw]) revert AlreadyRevealed();
        if (_accuracy > 100) revert InvalidAccuracy();
        bytes32 expected = keccak256(abi.encode(picks));
        if (expected != commitments[mw]) revert HashMismatch();

        _revealed[mw] = picks;
        accuracy[mw] = _accuracy;
        _hasRevealed[mw] = true;
        emit PicksRevealed(mw, picks, _accuracy);
    }

    function getRevealed(uint8 mw) external view returns (uint16[11] memory) {
        return _revealed[mw];
    }

    function hasRevealed(uint8 mw) external view returns (bool) {
        return _hasRevealed[mw];
    }
}
