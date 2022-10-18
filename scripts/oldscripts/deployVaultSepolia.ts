import { BigNumber } from "ethers";
import { ethers, upgrades } from "hardhat"
import { AlluoVaultUpgradeable } from "../typechain";

async function main() {

    let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
    // let rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xbe9461E39a0653D4Dd608807FA095226cF8c08c3");
    // let fraxUSDC =  await ethers.getContractAt("IERC20MetadataUpgradeable", "0x8dfc82C8E44E4e696CE601Fc83B6CFB29CE7161E");
    // const usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x0b6bb9E47179390B7Cf708b57ceF65a44a8038a9")
    // const frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0xa248F97F2B5448868aAdfcFBcfd430957Fc74bC9');
    // const crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x8dfc82C8E44E4e696CE601Fc83B6CFB29CE7161E");
    // const cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095");
    // const fraxUSDCPool=  await ethers.getContractAt("ICurvePool", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")


    // let gnosis = "0xbe9461E39a0653D4Dd608807FA095226cF8c08c3"


    // const AlluoVault = await upgrades.deployProxy(AlluoVaultFactory, [
    //     "Frax-USDC Vault",
    //     "abFraxUSDC",
    //     fraxUSDC.address,
    //     rewardToken.address,
    //     rewardToken.address,
    //     gnosis,
    //     "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
    //     [crv.address, cvx.address],
    //     [frax.address, usdc.address],
    //     100,
    //     fraxUSDCPool.address
    // ],  {
    //     initializer: 'initialize',
    //     kind: 'uups',
    //     useDeployedImplementation: false
    // }) as AlluoVaultUpgradeable;
    // await AlluoVault.deployed();
    // console.log("AlluoVault Deployed at :", AlluoVault.address);

    await upgrades.upgradeProxy("0x4339c596236b6903c2FDA32bEAb685710ec13D77", AlluoVaultFactory)
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//npx hardhat run scripts/deployVaultSepolia.ts --network mainnet