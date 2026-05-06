import type Items from '../structures/Items.js';
import type RustLabs from '../structures/RustLabs.js';

export interface IGameDataProvider {
    items: Items;
    rustlabs: RustLabs;
}
