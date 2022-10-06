import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

  let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
  let rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
  let fraxUSDC = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC");
  const usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
  const frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
  const crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
  const cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
  const fraxUSDCPool = await ethers.getContractAt("ICurvePool", "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2")


  let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"

  // const AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
  //   "Frax-USDC Vault",
  //   "abFraxUSDC",
  //   fraxUSDC.address,
  //   rewardToken.address,
  //   rewardToken.address, // Need to replace this through gnosis later
  //   gnosis,
  //   "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
  //   [crv.address, cvx.address],
  //   [frax.address, usdc.address],
  //   100,
  //   fraxUSDCPool.address
  // ], {
  //   initializer: 'initialize',
  //   kind: 'uups',
  //   useDeployedImplementation: false
  // }) as AlluoVaultUpgradeable;
  // await AlluoVault.deployed();
  // console.log("AlluoVault Deployed at :", AlluoVault.address);

  const AlluoVault = "0xcB9e36cD1A0eD9c98Db76d1619e649A7a032F271"
  let AlluoPoolFactory = await ethers.getContractFactory("FraxUSDCVaultPool")

  const AlluoPool = await upgrades.deployProxy(AlluoPoolFactory, [
    rewardToken.address, 
    gnosis, 
    [crv.address, cvx.address], 
    "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", 
    64, 
    AlluoVault, 
    cvx.address
  ],
  {
    initializer: 'initialize',
    kind: 'uups',
    useDeployedImplementation: true
  })
  console.log("Alluo Pool deployed at:", AlluoPool.address);

}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//npx hardhat run scripts/deployVaultSepolia.ts --network mainnet