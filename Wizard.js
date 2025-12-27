class Wizard extends Player {
    constructor(scene, id, name, team, x, y, isBot = false) {
        super(scene, id, name, team, x, y, isBot);
        
        this.role = 'wizard';
        
        // Wizard stats
        const stats = GAME_CONFIG.stats.wizard;
        this.maxHealth = stats.health;
        this.health = stats.health;
        this.damage = stats.damage;
        this.speed = stats.speed;
        this.attackRange = stats.attackRange;
        this.attackSpeed = stats.attackSpeed;
        this.weapon = stats.weapon;
        
        // Make wizard sprite look different (diamond shape)
        this.sprite.destroy();
        this.sprite = scene.add.star(x, y, 4, 12, 20, team === 1 ? GAME_CONFIG.colors.team1 : GAME_CONFIG.colors.team2);
        this.sprite.setStrokeStyle(2, 0x000000);
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        
        // Update name to show role
        this.nameText.setText(`${name} (Wizard)`);
    }
    
    performRangedAttack(target) {
        // Wizards always shoot fireballs
        const projectile = new Projectile(
            this.scene,
            this.sprite.x,
            this.sprite.y,
            target.sprite.x,
            target.sprite.y,
            'fireball',
            this.damage,
            this.id,
            this.team
        );
        
        this.scene.projectiles.push(projectile);
    }
}

