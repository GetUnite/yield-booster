import { BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat"
import { AlluoOmnivault, AlluoOmnivault__factory } from "../../typechain-types";

async function main() {
    const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
        "AlluoOmnivault"
    );
    let omnivaults = ["0xC7DBb63DceB6B20128FaB55797FD7AA832694867", "0x2bD0666E39b989c8B443b04b95a82CF0B5134980"]
    for (let i = 0; omnivaults.length < 2; i++) {
        await upgrades.prepareUpgrade(omnivaults[i], omniVaultFactory)
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

//npx hardhat run scripts\omnivault\upgradeOmnivault.ts --network optimisticEthereum