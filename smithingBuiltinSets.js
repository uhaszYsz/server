export const BUILTIN_SMITHING_SETS = [
    {
        setId: 'parrot',
        setName: 'Parrot armor',
        setEmoji: '🦜',
        recipes: [
            {
                recipeId: 'parrot_weapon',
                smithKey: 'weapon',
                equipKey: 'weapon1',
                short: 'WPN',
                titleHint: 'Weapon',
                output: {
                    name: '🦜 Parrot Cutlass',
                    displayName: 'Parrot Cutlass',
                    slot: 'weapon1',
                    slotLabel: 'Weapon',
                    stats: [
                        { stat: 'critical', value: 12 },
                        { stat: 'pierce', value: 8 },
                        { stat: 'reload', value: 5 }
                    ]
                },
                requirements: [
                    { matchName: 'Polished Gold', label: '🪙 Polished Gold', qty: 28 },
                    { matchName: 'Tropical Feather', label: '🧱 Tropical Feather', qty: 14 },
                    { matchName: 'Iron Ingot', label: '⚙️ Iron Ingot', qty: 6 }
                ]
            },
            {
                recipeId: 'parrot_head',
                smithKey: 'head',
                equipKey: 'helmet',
                short: 'HEAD',
                titleHint: 'Helmet',
                output: {
                    name: '🦜 Parrot Crest Helm',
                    displayName: 'Parrot Crest Helm',
                    slot: 'helmet',
                    slotLabel: 'Helmet',
                    stats: [
                        { stat: 'maxHp', value: 45 },
                        { stat: 'block', value: 6 },
                        { stat: 'recovery', value: 4 }
                    ]
                },
                requirements: [
                    { matchName: 'Polished Gold', label: '🪙 Polished Gold', qty: 18 },
                    { matchName: 'Tropical Feather', label: '🧱 Tropical Feather', qty: 22 },
                    { matchName: 'Emerald Shard', label: '💎 Emerald Shard', qty: 2 }
                ]
            },
            {
                recipeId: 'parrot_body',
                smithKey: 'body',
                equipKey: 'chest',
                short: 'BODY',
                titleHint: 'Chest',
                output: {
                    name: '🦜 Parrot Mail',
                    displayName: 'Parrot Mail',
                    slot: 'chest',
                    slotLabel: 'Chest',
                    stats: [
                        { stat: 'maxHp', value: 80 },
                        { stat: 'block', value: 10 },
                        { stat: 'knockback', value: 7 }
                    ]
                },
                requirements: [
                    { matchName: 'Polished Gold', label: '🪙 Polished Gold', qty: 42 },
                    { matchName: 'Tropical Feather', label: '🧱 Tropical Feather', qty: 16 },
                    { matchName: 'Iron Ingot', label: '⚙️ Iron Ingot', qty: 12 },
                    { matchName: 'Silk Thread', label: '🧵 Silk Thread', qty: 8 }
                ]
            },
            {
                recipeId: 'parrot_legs',
                smithKey: 'legs',
                equipKey: 'legs',
                short: 'LEGS',
                titleHint: 'Legs',
                output: {
                    name: '🦜 Parrot Greaves',
                    displayName: 'Parrot Greaves',
                    slot: 'legs',
                    slotLabel: 'Legs',
                    stats: [
                        { stat: 'maxHp', value: 55 },
                        { stat: 'recovery', value: 8 },
                        { stat: 'hitpointSize', value: 3 }
                    ]
                },
                requirements: [
                    { matchName: 'Polished Gold', label: '🪙 Polished Gold', qty: 24 },
                    { matchName: 'Tropical Feather', label: '🧱 Tropical Feather', qty: 10 },
                    { matchName: 'Iron Ingot', label: '⚙️ Iron Ingot', qty: 8 }
                ]
            },
            {
                recipeId: 'parrot_gloves',
                smithKey: 'gloves',
                equipKey: 'gloves',
                short: 'HAND',
                titleHint: 'Gloves',
                output: {
                    name: '🦜 Parrot Talons',
                    displayName: 'Parrot Talons',
                    slot: 'gloves',
                    slotLabel: 'Gloves',
                    stats: [
                        { stat: 'critical', value: 6 },
                        { stat: 'parry', value: 9 },
                        { stat: 'reload', value: 3 }
                    ]
                },
                requirements: [
                    { matchName: 'Polished Gold', label: '🪙 Polished Gold', qty: 14 },
                    { matchName: 'Tropical Feather', label: '🧱 Tropical Feather', qty: 18 },
                    { matchName: 'Silk Thread', label: '🧵 Silk Thread', qty: 5 }
                ]
            },
            {
                recipeId: 'parrot_boots',
                smithKey: 'boots',
                equipKey: 'boots',
                short: 'BOOT',
                titleHint: 'Boots',
                output: {
                    name: '🦜 Parrot Striders',
                    displayName: 'Parrot Striders',
                    slot: 'boots',
                    slotLabel: 'Boots',
                    stats: [
                        { stat: 'maxHp', value: 35 },
                        { stat: 'recovery', value: 10 },
                        { stat: 'knockback', value: 5 }
                    ]
                },
                requirements: [
                    { matchName: 'Polished Gold', label: '🪙 Polished Gold', qty: 16 },
                    { matchName: 'Tropical Feather', label: '🧱 Tropical Feather', qty: 12 },
                    { matchName: 'Emerald Shard', label: '💎 Emerald Shard', qty: 1 }
                ]
            }
        ]
    }
];
