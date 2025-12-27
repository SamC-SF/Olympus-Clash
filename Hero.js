class Hero extends Player {
    constructor(scene, id, name, team, x, y, heroType, isBot = false) {
        super(scene, id, name, team, x, y, isBot);
        
        this.heroType = heroType;
        this.role = 'hero';
        
        // Get hero-specific stats
        const stats = GAME_CONFIG.stats[heroType];
        this.maxHealth = stats.health;
        this.health = stats.health;
        this.damage = stats.damage;
        this.baseDamage = stats.damage;
        this.speed = stats.speed;
        this.attackRange = stats.attackRange;
        this.attackSpeed = stats.attackSpeed;
        this.weapon = stats.weapon;
        this.abilityName = stats.abilityName;
        this.abilityCooldown = stats.abilityCooldown;
        
        // Resize sprite based on weapon
        if (this.weapon === 'longsword') {
            this.sprite.setSize(35, 35);
        }
        
        // Hero-specific properties
        this.clone = null;
        this.rageActive = false;
        this.rageEndTime = 0;
        
        // Update name display with hero type
        this.nameText.setText(`${name} (${heroType.charAt(0).toUpperCase() + heroType.slice(1)})`);
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        if (!this.isAlive) return;
        
        // Update Achilles clone
        if (this.heroType === 'achilles' && this.clone) {
            if (!this.clone.isAlive) {
                this.clone = null;
            }
        }
        
        // Update Menelaus rage
        if (this.heroType === 'menelaus' && this.rageActive) {
            if (time >= this.rageEndTime) {
                this.endRage();
            }
        }
    }
    
    useAbility(scene = null, targetX = null, targetY = null) {
        if (!this.canUseAbility()) return false;
        
        const currentScene = scene || this.scene;
        
        switch (this.heroType) {
            case 'achilles':
                return this.spawnClone(currentScene);
            
            case 'agamemnon':
                return this.healTeam(currentScene);
            
            case 'menelaus':
                return this.activateRage();
            
            case 'odysseus':
                return this.activateAegis(currentScene);
        }
        
        return false;
    }
    
    // Achilles ability: Spawn clone
    spawnClone(scene) {
        if (this.clone && this.clone.isAlive) return false;
        
        const stats = GAME_CONFIG.stats.achilles.cloneStats;
        
        // Create clone as a modified version of Achilles
        this.clone = new AchillesClone(
            scene,
            `${this.id}_clone`,
            `${this.name}'s Clone`,
            this.team,
            this.sprite.x + 30,
            this.sprite.y,
            stats.health,
            stats.damage,
            this
        );
        
        scene.allPlayers.push(this.clone);
        
        this.lastAbilityTime = Date.now();
        
        // Emit ability use to server
        if (!this.isBot && scene.socket) {
            scene.socket.emit('use_ability', {
                abilityType: 'clone',
                position: { x: this.sprite.x, y: this.sprite.y }
            });
        }
        
        return true;
    }
    
    // Agamemnon ability: Heal team
    healTeam(scene) {
        const healAmount = this.maxHealth * GAME_CONFIG.stats.agamemnon.healAmount;
        
        // Heal all teammates
        scene.allPlayers.forEach(player => {
            if (player.team === this.team && player.isAlive) {
                // Don't heal Achilles clones
                if (!(player instanceof AchillesClone)) {
                    player.heal(healAmount);
                }
            }
        });
        
        this.lastAbilityTime = Date.now();
        
        // Visual effect
        const healCircle = scene.add.circle(this.sprite.x, this.sprite.y, 200, 0x00ff00, 0.3);
        scene.tweens.add({
            targets: healCircle,
            alpha: 0,
            scale: 1.5,
            duration: 1000,
            onComplete: () => healCircle.destroy()
        });
        
        // Emit ability use to server
        if (!this.isBot && scene.socket) {
            scene.socket.emit('use_ability', {
                abilityType: 'heal'
            });
        }
        
        return true;
    }
    
    // Menelaus ability: Rage
    activateRage() {
        const stats = GAME_CONFIG.stats.menelaus;
        this.rageActive = true;
        this.rageEndTime = Date.now() + stats.rageDuration;
        this.damage = this.baseDamage * (1 + stats.rageDamageBoost);
        
        // Visual effect - make sprite larger and orange
        this.sprite.setTint(0xff6600);
        this.scene.tweens.add({
            targets: this.sprite,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            ease: 'Power2'
        });
        
        this.lastAbilityTime = Date.now();
        
        // Emit ability use to server
        if (!this.isBot && this.scene.socket) {
            this.scene.socket.emit('use_ability', {
                abilityType: 'rage'
            });
        }
        
        return true;
    }
    
    endRage() {
        this.rageActive = false;
        this.damage = this.baseDamage;
        this.sprite.clearTint();
        this.scene.tweens.add({
            targets: this.sprite,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: 'Power2'
        });
    }
    
    // Odysseus ability: Aegis (freeze enemies)
    activateAegis(scene) {
        const freezeDuration = GAME_CONFIG.stats.odysseus.freezeDuration;
        
        // Freeze all enemies
        scene.allPlayers.forEach(player => {
            if (player.team !== this.team && player.isAlive) {
                player.freeze(freezeDuration);
            }
        });
        
        this.lastAbilityTime = Date.now();
        
        // Visual effect - freeze wave
        const freezeWave = scene.add.circle(this.sprite.x, this.sprite.y, 50, 0x00ffff, 0.5);
        scene.tweens.add({
            targets: freezeWave,
            alpha: 0,
            scale: 15,
            duration: 800,
            ease: 'Power2',
            onComplete: () => freezeWave.destroy()
        });
        
        // Emit ability use to server
        if (!this.isBot && scene.socket) {
            scene.socket.emit('use_ability', {
                abilityType: 'aegis'
            });
        }
        
        return true;
    }
    
    die(killerId) {
        // If Achilles dies, kill the clone too
        if (this.heroType === 'achilles' && this.clone && this.clone.isAlive) {
            this.clone.die(killerId);
        }
        
        // If in rage, end it
        if (this.rageActive) {
            this.endRage();
        }
        
        super.die(killerId);
    }
}

// Achilles Clone class
class AchillesClone extends Player {
    constructor(scene, id, name, team, x, y, health, damage, master) {
        super(scene, id, name, team, x, y, true);
        
        this.master = master;
        this.role = 'clone';
        
        // Clone stats
        this.maxHealth = health;
        this.health = health;
        this.damage = damage;
        this.baseDamage = damage;
        this.speed = GAME_CONFIG.stats.achilles.speed;
        this.attackRange = GAME_CONFIG.stats.achilles.attackRange;
        this.attackSpeed = GAME_CONFIG.stats.achilles.attackSpeed;
        this.weapon = 'longsword';
        
        // Make sprite slightly transparent to show it's a clone
        this.sprite.setAlpha(0.7);
        this.sprite.setSize(32, 32);
        
        // Animate spawn
        this.sprite.setScale(0);
        scene.tweens.add({
            targets: this.sprite,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }
    
    update(time, delta) {
        super.update(time, delta);
        
        // If master dies, clone dies
        if (this.master && !this.master.isAlive && this.isAlive) {
            this.die(null);
        }
    }
}

