document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const submitBtn = document.querySelector('.submit-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const computerModeBtn = document.querySelector('.computer-mode');
    const messagesContainer = document.getElementById('messages-container');
    const mainLogo = document.querySelector('.main-logo');
    const heroSection = document.querySelector('.hero-section');
    
    // File Upload Elements
    const uploadTrigger = document.getElementById('upload-trigger');
    const fileInput = document.getElementById('file-input');
    const filePreview = document.getElementById('file-preview');
    const fileNameDisplay = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');

    let selectedFile = null;

    // API Endpoint
    const API_URL = 'http://localhost:5000/api/chat';

    // Auto-resize textarea
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';

            // Toggle submit button state
            if (this.value.trim().length > 0 || selectedFile) {
                submitBtn.classList.add('active');
                submitBtn.disabled = false;
            } else {
                submitBtn.classList.remove('active');
                submitBtn.disabled = true;
            }
        });
    }

    // File Upload Logic
    uploadTrigger.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            fileNameDisplay.textContent = file.name;
            filePreview.classList.remove('hidden');
            submitBtn.classList.add('active');
            submitBtn.disabled = false;
        }
    });

    removeFileBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        if (!searchInput.value.trim()) {
            submitBtn.classList.remove('active');
            submitBtn.disabled = true;
        }
    });

    // Function to add a message to the UI
    const addMessage = (text, sender, isFromContext = false) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        if (isFromContext) {
            const contextBadge = document.createElement('div');
            contextBadge.className = 'context-badge';
            contextBadge.innerHTML = '<i data-lucide="file-check"></i> Answered from PDF';
            messageDiv.appendChild(contextBadge);
        }

        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        messageDiv.appendChild(textSpan);
        
        messagesContainer.appendChild(messageDiv);
        
        // Show container and hide logo if it's the first message
        if (messagesContainer.classList.contains('hidden')) {
            messagesContainer.classList.remove('hidden');
            mainLogo.style.transform = 'scale(0.8) translateY(-20px)';
            mainLogo.style.opacity = '0.5';
            heroSection.style.justifyContent = 'flex-start';
            heroSection.style.marginTop = '2rem';
        }

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    // Handle submission
    const handleSubmission = async () => {
        const prompt = searchInput.value.trim();
        if (!prompt && !selectedFile) return;

        // Create FormData for multipart submission
        const formData = new FormData();
        formData.append('prompt', prompt || 'Please analyze this document.');
        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        // Add user message to UI
        const displayPrompt = selectedFile ? `[File: ${selectedFile.name}] ${prompt}` : prompt;
        addMessage(displayPrompt, 'user');

        // Clear input and selection
        searchInput.value = '';
        searchInput.style.height = '24px';
        selectedFile = null;
        fileInput.value = '';
        filePreview.classList.add('hidden');
        submitBtn.classList.remove('active');
        submitBtn.disabled = true;

        // Add typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.textContent = 'Perplexity is analyzing...';
        messagesContainer.appendChild(typingIndicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData, // Browser sets multipart/form-data boundary automatically
            });

            const data = await response.json();
            
            // Remove typing indicator
            messagesContainer.removeChild(typingIndicator);

            if (data.status === 'success') {
                addMessage(data.response, 'ai', data.has_context);
            } else {
                addMessage('Error: ' + (data.error || 'Something went wrong'), 'ai');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            if (messagesContainer.contains(typingIndicator)) {
                messagesContainer.removeChild(typingIndicator);
            }
            addMessage('Error connecting to backend. Make sure the server is running.', 'ai');
        }
    };

    // Click event
    submitBtn.addEventListener('click', handleSubmission);

    // Enter key event
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmission();
        }
    });

    // Sidebar navigation active states
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Microphone / Speech Recognition Logic
    const micBtn = document.getElementById('mic-btn');
    let isRecording = false;
    let recognition = null;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Update search input
            if (finalTranscript || interimTranscript) {
                searchInput.value = finalTranscript + interimTranscript;
                
                // Trigger input event to resize textarea and update submit button
                searchInput.dispatchEvent(new Event('input'));
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };

        const stopRecording = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
            if (recognition) recognition.stop();
        };

        const startRecording = () => {
            try {
                recognition.start();
            } catch (err) {
                console.error('Failed to start recognition:', err);
            }
        };

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });
    } else {
        // Speech Recognition not supported
        if (micBtn) {
            micBtn.style.opacity = '0.3';
            micBtn.title = 'Speech recognition not supported in this browser';
            micBtn.style.cursor = 'not-allowed';
        }
    }

    // Computer Mode toggle
    if (computerModeBtn) {
        computerModeBtn.addEventListener('click', () => {
            computerModeBtn.classList.toggle('active-mode');
        });
    }

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
