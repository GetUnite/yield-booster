import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"
import { AlluoVaultPool, AlluoVaultUpgradeable } from "../typechain";

async function main() {

    let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
    let rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
    const crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
    const cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
    const weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
    const cvxEth =  await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");

    let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3"

    const cvxEthPool = await ethers.getContractAt("ICurvePool", "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4")  

    let AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
        "Cvx-Eth Vault",
        "abCvxEth",
        cvxEth.address,
        rewardToken.address,
        rewardToken.address,
        gnosis,
        "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
        [crv.address, cvx.address],
        [weth.address, cvx.address],
        64,
        cvxEthPool.address
    ], {
      initializer: 'initialize',
      kind: 'uups',
      useDeployedImplementation: true
  }) as AlluoVaultUpgradeable;
    console.log("Alluo Vault at:", AlluoVault.address)

    let PoolVaultFactory = await ethers.getContractFactory("AlluoVaultPool");
    let alluoPool = await upgrades.deployProxy(PoolVaultFactory, [
        rewardToken.address,
        gnosis,
        [crv.address, cvx.address],
        "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address
        64, //Pool number convex
        AlluoVault.address,
        cvx.address
    ],
    {
      initializer: 'initialize',
      kind: 'uups',
      useDeployedImplementation: true
  }) as AlluoVaultPool

    console.log("Alluo Pool at:", alluoPool.address)

    console.log("Make sure to set the pool through gnosis")
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//npx hardhat run scripts/deployVaultSepolia.ts --network mainnet