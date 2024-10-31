// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RBC Token
 * @dev Implementation of the RBC Token with governance and snapshot capabilities
 * 
 * Features:
 * - Fixed cap of 34,343,434 tokens
 * - Initial supply of 34,000,000 tokens
 * - Governance capabilities for DAO operations
 * - Snapshot functionality for historical balances
 * - Pausable transfers for emergency situations
 * - Burnable tokens
 */
contract RBCToken is ERC20Capped, ERC20Burnable, ERC20Pausable, ERC20Snapshot, ERC20Votes, Ownable {
    constructor() 
        ERC20("RBC Token", "RBC") 
        ERC20Capped(34343434 * 10**decimals()) 
        Ownable(msg.sender) 
        ERC20Permit("RBC Token")
    {
        _mint(msg.sender, 34000000 * 10**decimals());
    }

    /**
     * @dev Creates a new snapshot of token balances
     * @return the id of the newly created snapshot
     */
    function snapshot() public onlyOwner returns (uint256) {
        return _snapshot();
    }

    /**
     * @dev Mints new tokens, respecting the cap
     * @param to address to mint tokens to
     * @param amount amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= cap(), "RBCToken: cap exceeded");
        _mint(to, amount);
    }

    /**
     * @dev Pauses all token transfers
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    // Required overrides for compatibility between features
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Capped, ERC20Pausable, ERC20Snapshot, ERC20Votes)
    {
        super._update(from, to, amount);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}