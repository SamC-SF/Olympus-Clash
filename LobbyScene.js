class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
    }
    
    init(data) {
        this.socket = data.socket;
        this.playerId = data.playerId;
    }
    
    create() {
        // Lobby is handled by HTML UI, this scene just waits
        // The actual lobby UI is in index.html
    }
}

