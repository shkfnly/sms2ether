pragma solidity ^0.4.8;

contract Registry {

  mapping (bytes32 => address) public phone2address;

  event AddressAdded(address _address);

  function registerAddress(bytes32 _phoneNumber, address _address) {
    phone2address[_phoneNumber] = _address;
    AddressAdded(_address);
  }
}
