// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pick5Pool, IAavePool } from "./Pick5Pool.sol";

contract Pick5PoolFactory is Ownable {
    address public immutable poolImplementation;
    address public immutable usdt;
    address public immutable aavePool;
    address public immutable aUsdt;

    address public oracle;   // rotatable between tournaments (Phase B.1)
    address public coach;

    address[] public tournaments;
    mapping(uint256 => address) public tournamentBy;

    event TournamentCreated(
        uint256 indexed id,
        address pool,
        uint256 lockTime,
        uint256 endTime,
        uint256 deposit,
        string label
    );
    event OracleUpdated(address oracle);
    event CoachUpdated(address coach);

    error ZeroAddress();

    constructor(
        address _poolImplementation,
        address _usdt,
        address _aavePool,
        address _aUsdt,
        address _oracle,
        address _coach
    ) Ownable(msg.sender) {
        if (
            _poolImplementation == address(0) ||
            _usdt == address(0) ||
            _aavePool == address(0) ||
            _aUsdt == address(0)
        ) revert ZeroAddress();
        poolImplementation = _poolImplementation;
        usdt = _usdt;
        aavePool = _aavePool;
        aUsdt = _aUsdt;
        oracle = _oracle;
        coach = _coach;
    }

    function createTournament(
        uint256 lockTime,
        uint256 endTime,
        uint256 deposit,
        string calldata label
    ) external onlyOwner returns (address) {
        uint256 id = tournaments.length;
        address pool = Clones.clone(poolImplementation);
        Pick5Pool(pool).initialize(
            address(this),
            owner(),
            IERC20(usdt),
            IAavePool(aavePool),
            IERC20(aUsdt),
            lockTime,
            endTime,
            deposit,
            id,
            label
        );
        tournaments.push(pool);
        tournamentBy[id] = pool;
        emit TournamentCreated(id, pool, lockTime, endTime, deposit, label);
        return pool;
    }

    /// @dev Rotating the oracle affects ALL outstanding tournaments immediately
    /// (each pool reads factory.oracle() at submit time). Zero is rejected so a
    /// fat-fingered rotation can't silently disable score submission everywhere.
    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        oracle = _oracle;
        emit OracleUpdated(_oracle);
    }

    function setCoach(address _coach) external onlyOwner {
        coach = _coach;
        emit CoachUpdated(_coach);
    }

    function tournamentsLength() external view returns (uint256) {
        return tournaments.length;
    }
}
