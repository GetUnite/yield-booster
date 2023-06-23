import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { reset } from "@nomicfoundation/hardhat-network-helpers";
import { AlluoOmnivault, AlluoOmnivault__factory } from "../../typechain-types";

async function main() {
    // await reset(process.env.OPTIMISM_URL);

    const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
        "AlluoOmnivault"
    );
    const usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
    const admin = "0x4F7C41c019561f5cD0377d4B721B032b5366aC35";
   
    const exchange = await ethers.getContractAt("Exchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")




    let signers = await ethers.getSigners();
    console.log("The current deployer address is", signers[0].address);
  
    
    const USDOmnivault = (await upgrades.deployProxy(omniVaultFactory, [
        exchange.address,
        usdc.address,
        ["0x6AF5F3863B702b08C61589BDe88932C4A28A1797","0xa8fd81A0ec43841b64cDAE13F1F6816108fD37FF", "0xE7a6563073244044936734536c9fdfAa0B8583Cd"],
        [33,33,34],
        [ethers.constants.AddressZero, ethers.constants.AddressZero,ethers.constants.AddressZero],
        admin,
        1000,
        60 * 60 * 8
    ], {
        initializer: "initialize",
        redeployImplementation: 'never'
    })) as AlluoOmnivault;

    // console.log("Deployed ETH Omnivault at: ", ETHOmnivault.address);
    console.log("Deployed USD Omnivault at: ", USDOmnivault.address);
    // await USDOmnivault.deposit(ethers.constants.AddressZero, ethers.utils.parseEther("0.0001"), {value: ethers.utils.parseEther("0.0001")})
    // await USDOmnivault.withdraw(usdc.address, 100);
    // console.log(await usdc.balanceOf(signers[0].address))
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts/upgradeVaults.ts --network mainnet