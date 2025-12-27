class Soldier extends Player {
    constructor(scene, id, name, team, x, y, isBot = false) {
        super(scene, id, name, team, x, y, isBot);
        
        this.role = 'soldier';
        
        // Soldier stats
        const stats = GAME_CONFIG.stats.soldier;
        this.maxHealth = stats.health;
        this.health = stats.health;
        this.maxShieldHealth = stats.shieldHealth;
        this.shieldHealth = stats.shieldHealth;
        this.damage = stats.damage;
        this.speed = stats.speed;
        this.attackRange = stats.attackRange;
        this.attackSpeed = stats.attackSpeed;
        this.weapon = stats.weapon;
        
        // Create shield bar
        this.shieldBarBg = scene.add.rectangle(x, y - 19, 40, 3, 0x000000);
        this.shieldBar = scene.add.rectangle(x, y - 19, 40, 3, 0x4444ff);
        
        // Update name to show role
        this.nameText.setText(`${name} (Soldier)`);
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        if (!this.isAlive) return;
        
        // Update shield bar position
        this.shieldBarBg.setPosition(this.sprite.x, this.sprite.y - 19);
        this.shieldBar.setPosition(this.sprite.x, this.sprite.y - 19);
        
        // Update shield bar width
        const shieldPercent = this.shieldHealth / this.maxShieldHealth;
        this.shieldBar.width = 40 * shieldPercent;
        
        // Hide shield bar if depleted
        if (this.shieldHealth <= 0) {
            this.shieldBar.setVisible(false);
            this.shieldBarBg.setVisible(false);
        }
    }
    
    takeDamage(amount, attackerId) {
        if (!this.isAlive) return;
        
        // Shield absorbs damage first
        if (this.shieldHealth > 0) {
            const shieldDamage = Math.min(this.shieldHealth, amount);
            this.shieldHealth -= shieldDamage;
            amount -= shieldDamage;
            
            // Flash blue for shield damage
            this.sprite.setTint(0x4444ff);
            this.scene.time.delayedCall(100, () => {
                if (this.isAlive && !this.isFrozen) {
                    this.sprite.clearTint();
                }
            });
        }
        
        // Apply remaining damage to health
        if (amount > 0) {
            this.health -= amount;
            
            // Flash red for health damage
            this.sprite.setTint(0xff0000);
            this.scene.time.delayedCall(100, () => {
                if (this.isAlive && !this.isFrozen) {
                    this.sprite.clearTint();
                }
            });
        }
        
        if (this.health <= 0) {
            this.die(attackerId);
        }
    }
    
    destroy() {
        super.destroy();
        if (this.shieldBar) this.shieldBar.destroy();
        if (this.shieldBarBg) this.shieldBarBg.destroy();
    }
}

