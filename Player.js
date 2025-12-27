class Player {
    constructor(scene, id, name, team, x, y, isBot = false) {
        this.scene = scene;
        this.id = id;
        this.name = name;
        this.team = team;
        this.isBot = isBot;
        this.isAlive = true;
        
        // Create sprite
        this.sprite = scene.add.rectangle(x, y, 30, 30, team === 1 ? GAME_CONFIG.colors.team1 : GAME_CONFIG.colors.team2);
        this.sprite.setStrokeStyle(2, 0x000000);
        
        // Physics
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setCollideWorldBounds(true);
        
        // Create name text
        this.nameText = scene.add.text(x, y - 25, name, {
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        // Create health bar
        this.healthBarBg = scene.add.rectangle(x, y - 15, 40, 4, 0x000000);
        this.healthBar = scene.add.rectangle(x, y - 15, 40, 4, 0x00ff00);
        
        // Movement
        this.targetX = x;
        this.targetY = y;
        this.cursors = null;
        
        // Combat
        this.lastAttackTime = 0;
        this.isAttacking = false;
        
        // Abilities
        this.lastAbilityTime = 0;
        this.abilityActive = false;
        
        // Stats - to be overridden by subclasses
        this.maxHealth = 100;
        this.health = 100;
        this.damage = 100;
        this.speed = 100;
        this.attackRange = 35;
        this.attackSpeed = 1.0;
        this.weapon = 'sword';
        this.role = 'soldier';
        
        // Effects
        this.isFrozen = false;
        this.frozenUntil = 0;
    }
    
    update(time, delta) {
        if (!this.isAlive) return;
        
        // Update frozen state
        if (this.isFrozen && time >= this.frozenUntil) {
            this.isFrozen = false;
            this.sprite.clearTint();
        }
        
        // Update positions
        this.healthBarBg.setPosition(this.sprite.x, this.sprite.y - 15);
        this.healthBar.setPosition(this.sprite.x, this.sprite.y - 15);
        this.nameText.setPosition(this.sprite.x, this.sprite.y - 25);
        
        // Update health bar width
        const healthPercent = this.health / this.maxHealth;
        this.healthBar.width = 40 * healthPercent;
        
        // Update health bar color
        if (healthPercent > 0.6) {
            this.healthBar.setFillStyle(0x00ff00);
        } else if (healthPercent > 0.3) {
            this.healthBar.setFillStyle(0xffff00);
        } else {
            this.healthBar.setFillStyle(0xff0000);
        }
    }
    
    moveTo(x, y) {
        if (this.isFrozen || !this.isAlive) return;
        
        this.targetX = x;
        this.targetY = y;
        
        const angle = Math.atan2(y - this.sprite.y, x - this.sprite.x);
        this.sprite.body.setVelocity(
            Math.cos(angle) * this.speed,
            Math.sin(angle) * this.speed
        );
    }
    
    stopMovement() {
        this.sprite.body.setVelocity(0, 0);
    }
    
    attack(target) {
        if (!this.isAlive || !target.isAlive || this.isFrozen) return false;
        
        const time = Date.now();
        const cooldown = 1000 / this.attackSpeed;
        
        if (time - this.lastAttackTime < cooldown) return false;
        
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x, this.sprite.y,
            target.sprite.x, target.sprite.y
        );
        
        if (distance <= this.attackRange) {
            // Melee attack
            this.performMeleeAttack(target);
            this.lastAttackTime = time;
            return true;
        } else if (this.weapon === 'bow' || this.weapon === 'fireball') {
            // Ranged attack
            this.performRangedAttack(target);
            this.lastAttackTime = time;
            return true;
        }
        
        return false;
    }
    
    performMeleeAttack(target) {
        // Visual feedback
        const originalX = this.sprite.x;
        const originalY = this.sprite.y;
        
        const angle = Math.atan2(target.sprite.y - this.sprite.y, target.sprite.x - this.sprite.x);
        const lungeDistance = 10;
        
        this.scene.tweens.add({
            targets: this.sprite,
            x: originalX + Math.cos(angle) * lungeDistance,
            y: originalY + Math.sin(angle) * lungeDistance,
            duration: 100,
            yoyo: true,
            ease: 'Power2'
        });
        
        // Apply damage
        target.takeDamage(this.damage, this.id);
    }
    
    performRangedAttack(target) {
        const projectile = new Projectile(
            this.scene,
            this.sprite.x,
            this.sprite.y,
            target.sprite.x,
            target.sprite.y,
            this.weapon,
            this.damage,
            this.id,
            this.team
        );
        
        this.scene.projectiles.push(projectile);
    }
    
    takeDamage(amount, attackerId) {
        if (!this.isAlive) return;
        
        this.health -= amount;
        
        // Flash red
        this.sprite.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.isAlive) {
                this.sprite.clearTint();
            }
        });
        
        if (this.health <= 0) {
            this.die(attackerId);
        }
    }
    
    heal(amount) {
        if (!this.isAlive) return;
        
        this.health = Math.min(this.health + amount, this.maxHealth);
        
        // Flash green
        this.sprite.setTint(0x00ff00);
        this.scene.time.delayedCall(200, () => {
            if (this.isAlive) {
                this.sprite.clearTint();
            }
        });
    }
    
    freeze(duration) {
        this.isFrozen = true;
        this.frozenUntil = Date.now() + duration;
        this.sprite.setTint(0x00ffff);
        this.stopMovement();
    }
    
    die(killerId) {
        this.isAlive = false;
        this.health = 0;
        
        // Death animation
        this.sprite.setTint(0x000000);
        this.scene.tweens.add({
            targets: [this.sprite, this.nameText, this.healthBar, this.healthBarBg],
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.destroy();
            }
        });
        
        // Emit death event
        if (!this.isBot && this.scene.socket) {
            this.scene.socket.emit('player_death', { killerId });
        }
    }
    
    destroy() {
        this.sprite.destroy();
        this.nameText.destroy();
        this.healthBar.destroy();
        this.healthBarBg.destroy();
    }
    
    useAbility() {
        // To be overridden by subclasses
        return false;
    }
    
    canUseAbility() {
        if (!this.isAlive || this.isFrozen) return false;
        
        const time = Date.now();
        const cooldown = this.abilityCooldown || 0;
        
        return time - this.lastAbilityTime >= cooldown;
    }
}

