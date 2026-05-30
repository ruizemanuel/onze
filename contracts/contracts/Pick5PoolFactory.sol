// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pick5Pool, IAavePool } from "./Pick5Pool.sol";
import { SeasonPool } from "./SeasonPool.sol";

contract Pick5PoolFactory is Ownable {
    address public immutable poolImplementation;
    address public immutable usdt;
    address public immutable aavePool;
    address public immutable aUsdt;

    address public oracle;   // rotatable between tournaments (Phase B.1)
    address public coach;

    address[] public tournaments;
    mapping(uint256 => address) public tournamentBy;

    address public seasonImplementation;   // set once after deploy (clone target)
    address[] public seasons;
    mapping(uint256 => address) public seasonBy;

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
    event SeasonImplementationUpdated(address impl);
    event SeasonCreated(uint256 indexed id, address pool, uint256 endTime, string label);

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

    /// @dev Additive: the season implementation is set after deploy rather than in
    /// the ctor, so the existing factory ctor + tests are untouched. Owner-only;
    /// only affects FUTURE createSeason calls (existing season clones are
    /// immutable once cloned). Zero is rejected.
    function setSeasonImplementation(address _impl) external onlyOwner {
        if (_impl == address(0)) revert ZeroAddress();
        seasonImplementation = _impl;
        emit SeasonImplementationUpdated(_impl);
    }

    function createSeason(
        uint256 endTime,
        string calldata label
    ) external onlyOwner returns (address) {
        if (seasonImplementation == address(0)) revert ZeroAddress();
        uint256 id = seasons.length;
        address pool = Clones.clone(seasonImplementation);
        SeasonPool(pool).initialize(
            address(this),
            owner(),
            usdt,
            aavePool,
            aUsdt,
            endTime,
            id,
            label
        );
        seasons.push(pool);
        seasonBy[id] = pool;
        emit SeasonCreated(id, pool, endTime, label);
        return pool;
    }

    function seasonsLength() external view returns (uint256) {
        return seasons.length;
    }

    function tournamentsLength() external view returns (uint256) {
        return tournaments.length;
    }
}
