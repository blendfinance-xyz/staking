import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.5.16" },
      { version: "0.6.6" },
      { version: "0.8.20" },
    ],
  },
  networks: {
    // "blast-mainnet": {
    //   url: "coming end of February",
    //   accounts: [process.env.PRIVATE_KEY as string],
    //   gasPrice: 1000000000,
    // },
    "blast-sepolia": {
      url: "https://sepolia.blast.io",
      accounts: [process.env.PRIVATE_KEY as string],
      gasPrice: 1000000000,
    },
    localhost: {
      url: "http://localhost:8545",
      accounts: [
        "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
      ],
      gasPrice: 1000000000,
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  etherscan: {
    apiKey: {
      "blast-sepolia": "blast-sepolia", // apiKey is not required, just set a placeholder
    },
    customChains: [
      {
        network: "blast-sepolia",
        chainId: 168587773,
        urls: {
          apiURL:
            "https://api.routescan.io/v2/network/testnet/evm/168587773/etherscan",
          browserURL: "https://testnet.blastscan.io",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};

export default config;
