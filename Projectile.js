class Projectile {
    constructor(scene, startX, startY, targetX, targetY, type, damage, ownerId, team) {
        this.scene = scene;
        this.type = type;
        this.damage = damage;
        this.ownerId = ownerId;
        this.team = team;
        this.active = true;
        
        // Get projectile config
        const config = type === 'fireball' ? GAME_CONFIG.projectiles.fireball : GAME_CONFIG.projectiles.arrow;
        
        // Calculate direction
        const angle = Math.atan2(targetY - startY, targetX - startX);
        
        // Create sprite
        if (type === 'fireball') {
            this.sprite = scene.add.circle(startX, startY, config.size, 0xff6600);
            this.sprite.setStrokeStyle(1, 0xff0000);
            
            // Add particle trail
            this.trail = scene.add.particles(startX, startY, 'particle', {
                speed: 50,
                scale: { start: 0.5, end: 0 },
                blendMode: 'ADD',
                lifespan: 300,
                tint: 0xff6600,
                follow: this.sprite
            });
        } else {
            // Arrow
            this.sprite = scene.add.rectangle(startX, startY, 10, config.size, 0x8B4513);
            this.sprite.rotation = angle;
        }
        
        // Add physics
        scene.physics.add.existing(this.sprite);
        
        // Set velocity
        this.sprite.body.setVelocity(
            Math.cos(angle) * config.speed,
            Math.sin(angle) * config.speed
        );
        
        // Track distance traveled
        this.startX = startX;
        this.startY = startY;
        this.maxDistance = 1000;
    }
    
    update(scene) {
        if (!this.active) return;
        
        // Check if out of bounds
        if (this.sprite.x < 0 || this.sprite.x > GAME_CONFIG.width ||
            this.sprite.y < 0 || this.sprite.y > GAME_CONFIG.height) {
            this.destroy();
            return;
        }
        
        // Check distance traveled
        const distance = Phaser.Math.Distance.Between(
            this.startX, this.startY,
            this.sprite.x, this.sprite.y
        );
        
        if (distance > this.maxDistance) {
            this.destroy();
            return;
        }
        
        // Check collision with players
        scene.allPlayers.forEach(player => {
            if (player.isAlive && player.team !== this.team) {
                const dist = Phaser.Math.Distance.Between(
                    this.sprite.x, this.sprite.y,
                    player.sprite.x, player.sprite.y
                );
                
                // Check collision (projectile radius + player radius)
                if (dist < 20) {
                    player.takeDamage(this.damage, this.ownerId);
                    this.createImpactEffect();
                    this.destroy();
                }
            }
        });
    }
    
    createImpactEffect() {
        if (this.type === 'fireball') {
            // Explosion effect
            const explosion = this.scene.add.circle(this.sprite.x, this.sprite.y, 15, 0xff6600, 0.8);
            this.scene.tweens.add({
                targets: explosion,
                scale: 2,
                alpha: 0,
                duration: 200,
                onComplete: () => explosion.destroy()
            });
        } else {
            // Arrow impact
            const impact = this.scene.add.circle(this.sprite.x, this.sprite.y, 5, 0xffff00, 0.8);
            this.scene.tweens.add({
                targets: impact,
                scale: 1.5,
                alpha: 0,
                duration: 150,
                onComplete: () => impact.destroy()
            });
        }
    }
    
    destroy() {
        this.active = false;
        
        if (this.trail) {
            this.trail.destroy();
        }
        
        if (this.sprite) {
            this.sprite.destroy();
        }
    }
}

