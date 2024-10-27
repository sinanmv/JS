class VideoChat extends HTMLElement {
    constructor() {
        super();
        this.localVideoContainer = document.createElement('div');
        this.remoteVideoContainer = document.createElement('div');
        this.attachShadow({ mode: 'open' }).appendChild(this.createTemplate());
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.roomId = this.getAttribute('room-id');
        this.webSocket = new WebSocket('ws://localhost:8080');
        this.pendingIceCandidates = []; // Array to hold pending ICE candidates
        this.remoteVideoAdded = false; // Flag to track if remote video is already added
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.webSocket.onopen = () => {
            console.log('WebSocket connection established');
            this.webSocket.send(JSON.stringify({ roomId: this.roomId }));
        };

        this.webSocket.onmessage = async (event) => {
            console.log('Message received:', event.data);
            try {
                const message = JSON.parse(event.data);
                if (message.roomId === this.roomId) {
                    if (message.offer) {
                        await this.handleOffer(message.offer);
                    } else if (message.answer) {
                        await this.handleAnswer(message.answer);
                    } else if (message.iceCandidate) {
                        await this.handleIceCandidate(message.iceCandidate);
                    }
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        window.addEventListener('load', () => this.startCall());
    }

    async startCall() {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = document.createElement('video');
        localVideo.srcObject = this.localStream;
        localVideo.play();
        this.localVideoContainer.appendChild(localVideo);

        this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                this.webSocket.send(JSON.stringify({ roomId: this.roomId, iceCandidate: event.candidate }));
            }
        };

        this.peerConnection.ontrack = (event) => {
            this.addRemoteVideo(event.streams[0]);
        };

        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        console.log('Sending offer:', offer);
        this.webSocket.send(JSON.stringify({ roomId: this.roomId, offer }));
    }

    async handleOffer(offer) {
        if (!this.peerConnection) {
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
        }

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                this.webSocket.send(JSON.stringify({ roomId: this.roomId, iceCandidate: event.candidate }));
            }
        };

        this.pendingIceCandidates.forEach(candidate => {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        });
        this.pendingIceCandidates = []; // Clear the queue

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        console.log('Sending answer:', answer);
        this.webSocket.send(JSON.stringify({ roomId: this.roomId, answer }));
    }

    async handleAnswer(answer) {
        if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            this.pendingIceCandidates.forEach(candidate => {
                this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            });
            this.pendingIceCandidates = []; // Clear the queue
        }
    }

    async handleIceCandidate(iceCandidate) {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
        } else {
            console.log('Remote description not set. Queuing ICE candidate:', iceCandidate);
            this.pendingIceCandidates.push(iceCandidate);
        }
    }

    addRemoteVideo(stream) {
        if (!this.remoteVideoAdded) {
            this.remoteStream = stream;
            const remoteVideo = document.createElement('video');
            remoteVideo.srcObject = this.remoteStream;
            remoteVideo.play();
            this.remoteVideoContainer.appendChild(remoteVideo);
            this.remoteVideoAdded = true; // Set the flag to true
        }
    }

    createTemplate() {
        const container = document.createElement('div');
        container.setAttribute('class', 'video-chat-container');

        // Style the container
        const style = document.createElement('style');
        style.textContent = `
            .video-chat-container {
                position: relative;
                width: 100%;
                height: 100vh; /* Full viewport height */
                background-color: black;
            }
            .remote-video {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80%; /* Adjust as needed */
                height: auto; /* Maintain aspect ratio */
                border: 2px solid white; /* Optional styling */
            }
            .local-video {
                position: absolute;
                bottom: 57%;
                right: 26%;
                width: 0px;
                height: 0px;
                border: 2px solid white;
                border-radius: 8px;
                z-index: 10;
                transform: translate(-50%, -50%);
            }
            .local-video > video {
                width: 400px;
                height: 400px;
            }
        `;

        container.appendChild(style);
        container.appendChild(this.remoteVideoContainer);
        container.appendChild(this.localVideoContainer);

        // Add classes to video containers
        this.remoteVideoContainer.classList.add('remote-video');
        this.localVideoContainer.classList.add('local-video');

        return container;
    }
}

customElements.define('video-chat', VideoChat);
