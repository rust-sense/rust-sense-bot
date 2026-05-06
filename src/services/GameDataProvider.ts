import type { IGameDataProvider } from '../interfaces/IGameDataProvider.js';
import Cctv from '../structures/Cctv.js';
import Items from '../structures/Items.js';
import RustLabs from '../structures/RustLabs.js';

export class GameDataProvider implements IGameDataProvider {
    readonly items: Items;
    readonly rustlabs: RustLabs;
    readonly cctv: Cctv;

    constructor() {
        this.items = new Items();
        this.rustlabs = new RustLabs();
        this.cctv = new Cctv();
    }
}
