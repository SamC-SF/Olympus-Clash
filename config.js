// Game configuration
const GAME_CONFIG = {
    width: 1280,
    height: 720,
    
    // Arena dimensions (Clash Royale style)
    arena: {
        width: 1200,
        height: 680,
        team1SpawnX: 150,
        team1SpawnY: 340,
        team2SpawnX: 1050,
        team2SpawnY: 340,
        backgroundColor: 0x87A96B, // Grass green like Clash Royale Arena 1
        borderColor: 0x6B5344, // Brown border
        borderWidth: 20
    },
    
    // Player stats
    stats: {
        // Heroes
        achilles: {
            health: 75,
            damage: 150,
            speed: 120,
            attackRange: 45,
            attackSpeed: 1.2,
            weapon: 'longsword',
            abilityName: 'Clone',
            abilityCooldown: 45000,
            cloneStats: {
                health: 56.25,
                damage: 112.5
            }
        },
        agamemnon: {
            health: 100,
            damage: 100,
            speed: 100,
            attackRange: 35,
            attackSpeed: 1.0,
            weapon: 'sword',
            abilityName: 'Heal',
            abilityCooldown: 60000,
            healAmount: 0.5 // 50% of max health
        },
        menelaus: {
            health: 100,
            damage: 100,
            speed: 100,
            attackRange: 35,
            attackSpeed: 1.0,
            weapon: 'sword',
            abilityName: 'Rage',
            abilityCooldown: 25000,
            rageDuration: 8000,
            rageDamageBoost: 0.5 // +50% damage
        },
        odysseus: {
            health: 100,
            damage: 100,
            speed: 100,
            attackRange: 400,
            attackSpeed: 1.5,
            weapon: 'bow',
            abilityName: 'Aegis',
            abilityCooldown: 30000,
            freezeDuration: 5000
        },
        
        // Wizard
        wizard: {
            health: 120,
            damage: 80,
            speed: 90,
            attackRange: 400,
            attackSpeed: 2.0,
            weapon: 'fireball'
        },
        
        // Soldier
        soldier: {
            health: 100,
            shieldHealth: 50,
            damage: 100,
            speed: 100,
            attackRange: 35,
            attackSpeed: 1.0,
            weapon: 'sword'
        }
    },
    
    // Projectile speeds
    projectiles: {
        arrow: {
            speed: 600,
            size: 4
        },
        fireball: {
            speed: 500,
            size: 8
        }
    },
    
    // Colors for teams
    colors: {
        team1: 0xFF4444,  // Red
        team2: 0x4444FF,  // Blue
        bot: 0xAAAAAA     // Gray indicator
    },
    
    // Timing
    timing: {
        lobbyWait: 10000,        // 10 seconds
        lobbyAutoFill: 30000,    // 30 seconds with 5+ players
        roleSelection: 90000,    // 90 seconds
        battleCountdown: 10000,  // 10 seconds
        mainGameTime: 180000,    // 3 minutes
        overtimeTime: 60000      // 60 seconds
    }
};

// Hero info for UI
const HERO_INFO = {
    achilles: {
        name: 'Achilles',
        description: 'Lowest health, highest damage. Can spawn a bot clone that recharges every 45 secs.',
        weapon: 'Longsword',
        ability: 'Clone (45s cooldown)'
    },
    agamemnon: {
        name: 'Agamemnon',
        description: 'Can heal all players on his team. Average health and damage.',
        weapon: 'Sword',
        ability: 'Team Heal (60s cooldown)'
    },
    menelaus: {
        name: 'Menelaus',
        description: 'Rage gives him a damage boost. Average health and damage.',
        weapon: 'Sword',
        ability: 'Rage (+50% DMG, 25s cooldown)'
    },
    odysseus: {
        name: 'Odysseus',
        description: 'Freezes the enemy team in place for 5 secs. Average health and damage.',
        weapon: 'Bow and Arrows',
        ability: 'Aegis Freeze (30s cooldown)'
    }
};

