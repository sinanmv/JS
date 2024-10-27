const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const clients = {}; // Store clients by room ID

wss.on('connection', (webSocket) => {
    // When a new message is received
    webSocket.on('message', (message) => {
        // Check if the message is a Buffer and convert it to a string
        if (Buffer.isBuffer(message)) {
            message = message.toString(); // Convert Buffer to string
        }
        
        // console.log('Message received:', message);
        
        try {
            const parsedMessage = JSON.parse(message);
            const roomId = parsedMessage.roomId;

            // Ensure roomId is defined
            if (!roomId) {
                console.error('Room ID is required');
                return;
            }

            // Store clients in the specific room
            if (!clients[roomId]) {
                clients[roomId] = [];
            }
            // Add the new client to the room
            clients[roomId].push(webSocket);

            // Broadcast the message to all clients in the room
            clients[roomId].forEach(client => {
                if (client !== webSocket && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // When the client disconnects
    webSocket.on('close', () => {
        // Remove the client from all rooms upon disconnection
        for (const roomId in clients) {
            clients[roomId] = clients[roomId].filter(client => client !== webSocket);
            if (clients[roomId].length === 0) {
                delete clients[roomId]; // Clean up empty rooms
            }
        }
        console.log('Client disconnected, cleaned up rooms.');
    });
});

// Start the WebSocket server
console.log('WebSocket server is running on ws://localhost:8080');
