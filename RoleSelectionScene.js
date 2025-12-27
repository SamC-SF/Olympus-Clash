class RoleSelectionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RoleSelectionScene' });
    }
    
    init(data) {
        this.socket = data.socket;
        this.playerId = data.playerId;
        this.isCaptain = data.isCaptain;
        this.teamNum = data.teamNum;
        this.captainRole = data.captainRole;
        this.teamPlayers = data.teamPlayers;
        this.assignedRoles = data.assignedRoles || {};
    }
    
    create() {
        // Role selection is handled by HTML UI
        // This scene just waits for role assignments
    }
}

