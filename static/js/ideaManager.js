class IdeaManager {
    constructor(workspaceId) {
        this.workspace = document.getElementById(workspaceId);
        this.ideas = [];
        this.connections = [];
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.selectedIdea = null;
        this.isSelectMode = false;
        this.selectedIdeas = [];
        this.activeTooltip = null;
        this.isMergeMode = false;
        this.mergeIdeas = [];
        this.generatedIdeas = [];
        this.maxHistoryItems = 10;
        this.timer = null;
        this.timerDuration = 5 * 1000;
        this.remainingTime = this.timerDuration;
        this.isTimerPaused = false;
        this.countdownDisplay = document.getElementById('countdownDisplay');
        this.velocities = new Map();
        this.lastFrameTime = performance.now();
        this.animationFrame = null;
        this.currentRating = 0;

        // Initialize the ideas list reference
        this.ideasList = document.getElementById('ideas-list');
        
        if (!this.ideasList) {
            console.warn('Ideas list element not found in the DOM');
        }

        this.setupEventListeners();
        this.updateCountdownDisplay();
        this.startPhysicsLoop();

        window.addEventListener('resize', () => {
            this.drawConnections();
        });

        // Add toggle functionality for ideas history
        this.setupHistoryToggle();
        this.setupRatingSystem();
    }

    setupEventListeners() {
        this.workspace.addEventListener('click', (e) => {
            if (e.target === this.workspace) {
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left + this.workspace.scrollLeft;
                const y = e.clientY - rect.top + this.workspace.scrollTop;
                
                const event = new CustomEvent('workspace-click', {
                    detail: { x, y }
                });
                document.dispatchEvent(event);
            }
        });
    }

    enterSelectMode() {
        this.isSelectMode = true;
        this.selectedIdeas = [];
        this.ideas.forEach(idea => {
            idea.element.addEventListener('click', this.handleIdeaSelection);
            idea.element.style.cursor = 'pointer';
        });
    }

    exitSelectMode() {
        this.isSelectMode = false;
        this.selectedIdeas.forEach(idea => {
            idea.element.classList.remove('merge-mode');
        });
        this.ideas.forEach(idea => {
            idea.element.removeEventListener('click', this.handleIdeaSelection);
            idea.element.style.cursor = 'move';
        });
        this.selectedIdeas = [];
    }

    handleIdeaSelection = (e) => {
        e.stopPropagation();
        const clickedElement = e.currentTarget;
        const idea = this.ideas.find(i => i.element === clickedElement);
        
        if (idea) {
            const index = this.selectedIdeas.findIndex(i => i === idea);
            if (index === -1 && this.selectedIdeas.length < 2) {
                this.selectedIdeas.push(idea);
                clickedElement.classList.add('merge-mode');
            } else if (index !== -1) {
                this.selectedIdeas.splice(index, 1);
                clickedElement.classList.remove('merge-mode');
            }
        }
    }

    updateCountdownDisplay() {
        if (!this.timerEndTime) return;
        
        const timeLeft = Math.max(0, this.remainingTime);
        const seconds = Math.floor(timeLeft / 1000);
        
        if (this.countdownDisplay) {
            this.countdownDisplay.textContent = seconds.toString();
        }
    }

    handleTimerExpired() {
        // Get all visible idea balls
        const visibleIdeas = Array.from(this.ideas).filter(idea => 
            !idea.element.classList.contains('generating') && 
            idea.element.style.display !== 'none'
        );

        if (visibleIdeas.length >= 2) {
            // Randomly select two different ideas
            const idea1 = visibleIdeas[Math.floor(Math.random() * visibleIdeas.length)];
            let idea2;
            do {
                idea2 = visibleIdeas[Math.floor(Math.random() * visibleIdeas.length)];
            } while (idea2 === idea1);

            // Select both ideas for merging
            this.mergeIdeas = [idea1, idea2];
            
            // Add visual indication
            idea1.element.classList.add('merge-mode');
            idea2.element.classList.add('merge-mode');
            
            // Trigger the merge
            this.handleMerge();
        }

        // Restart the timer
        this.startTimer();
    }

    startTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.timerEndTime = Date.now() + this.timerDuration;
        this.remainingTime = this.timerDuration;
        
        this.timer = setInterval(() => {
            if (!this.isTimerPaused) {
                const now = Date.now();
                const timeLeft = Math.max(0, this.timerEndTime - now);
                this.remainingTime = timeLeft;
                
                this.updateCountdownDisplay();
                
                if (timeLeft === 0) {
                    this.handleTimerExpired();
                }
            }
        }, 100);
        
        this.updateCountdownDisplay();
    }

    pauseTimer() {
        this.isTimerPaused = true;
    }

    resumeTimer() {
        this.isTimerPaused = false;
        if (this.timer) {
            this.timerEndTime = Date.now() + this.remainingTime;
        }
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.timerEndTime = null;
            this.remainingTime = this.timerDuration;
            this.updateCountdownDisplay();
        }
    }

    setTimerDuration(seconds) {
        this.timerDuration = seconds * 1000;
        this.remainingTime = this.timerDuration;
        this.updateCountdownDisplay();
    }

    startPhysicsLoop() {
        const animate = () => {
            const currentTime = performance.now();
            const deltaTime = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;

            this.updatePhysics(deltaTime);
            this.animationFrame = requestAnimationFrame(animate);
        };
        this.animationFrame = requestAnimationFrame(animate);
    }

    stopPhysicsLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    updatePhysics(deltaTime) {
        const damping = 0.85;
        const minSpeed = 0.5;
        const leftBoundary = 950;

        for (const idea of this.ideas) {
            if (!this.isDragging || idea.element !== this.selectedIdea) {
                let velocity = this.velocities.get(idea) || { x: 0, y: 0 };
                
                velocity.x *= Math.abs(velocity.x) > 10 ? 0.8 : damping;
                velocity.y *= Math.abs(velocity.y) > 10 ? 0.8 : damping;

                let x = parseInt(idea.element.style.left) + velocity.x * deltaTime;
                let y = parseInt(idea.element.style.top) + velocity.y * deltaTime;

                if (x < leftBoundary) {
                    x = leftBoundary;
                    velocity.x = -velocity.x;
                }

                if (x > this.workspace.clientWidth - idea.element.clientWidth) {
                    x = this.workspace.clientWidth - idea.element.clientWidth;
                    velocity.x = -velocity.x;
                }
                if (y < 0) {
                    y = 0;
                    velocity.y = -velocity.y;
                }
                if (y > this.workspace.clientHeight - idea.element.clientHeight) {
                    y = this.workspace.clientHeight - idea.element.clientHeight;
                    velocity.y = -velocity.y;
                }

                if (Math.abs(velocity.x) < minSpeed) velocity.x = 0;
                if (Math.abs(velocity.y) < minSpeed) velocity.y = 0;

                requestAnimationFrame(() => {
                    idea.element.style.left = `${x}px`;
                    idea.element.style.top = `${y}px`;
                });
                this.velocities.set(idea, velocity);
            }
        }

        for (let i = 0; i < this.ideas.length; i++) {
            for (let j = i + 1; j < this.ideas.length; j++) {
                const idea1 = this.ideas[i];
                const idea2 = this.ideas[j];

                if (this.isDragging && (idea1.element === this.selectedIdea || idea2.element === this.selectedIdea)) {
                    continue;
                }

                const pos1 = {
                    x: parseInt(idea1.element.style.left),
                    y: parseInt(idea1.element.style.top)
                };
                const pos2 = {
                    x: parseInt(idea2.element.style.left),
                    y: parseInt(idea2.element.style.top)
                };

                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = 120;

                if (distance < minDistance) {
                    const angle = Math.atan2(dy, dx);
                    
                    const speed = 30;
                    
                    const newVel1 = {
                        x: -speed * Math.cos(angle) * 0.3,
                        y: -speed * Math.sin(angle) * 0.3
                    };
                    const newVel2 = {
                        x: speed * Math.cos(angle) * 0.3,
                        y: speed * Math.sin(angle) * 0.3
                    };
                    
                    this.velocities.set(idea1, newVel1);
                    this.velocities.set(idea2, newVel2);

                    const overlap = (minDistance - distance) * 0.5;
                    const separationX = (overlap * dx) / distance / 2;
                    const separationY = (overlap * dy) / distance / 2;

                    idea1.element.style.left = `${pos1.x - separationX}px`;
                    idea1.element.style.top = `${pos1.y - separationY}px`;
                    idea2.element.style.left = `${pos2.x + separationX}px`;
                    idea2.element.style.top = `${pos2.y + separationY}px`;
                }
            }
        }

        this.drawConnections();
    }

    setupDragListeners(ideaBall) {
        ideaBall.addEventListener('dragstart', (e) => {
            if (!this.isSelectMode) {
                this.isDragging = true;
                this.selectedIdea = ideaBall;
                const rect = ideaBall.getBoundingClientRect();
                this.dragStartPos = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                const dragImage = document.createElement('div');
                dragImage.style.width = '0';
                dragImage.style.height = '0';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                setTimeout(() => document.body.removeChild(dragImage), 0);

                const idea = this.ideas.find(i => i.element === ideaBall);
                this.velocities.set(idea, { x: 0, y: 0 });
            }
        });

        ideaBall.addEventListener('drag', (e) => {
            if (this.isSelectMode || e.clientX === 0 && e.clientY === 0) return;
            
            requestAnimationFrame(() => {
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left + this.workspace.scrollLeft - this.dragStartPos.x;
                const y = e.clientY - rect.top + this.workspace.scrollTop - this.dragStartPos.y;
                
                const minPadding = 120;
                const boundedX = Math.max(minPadding, Math.min(x, this.workspace.clientWidth - minPadding));
                const boundedY = Math.max(minPadding, Math.min(y, this.workspace.clientHeight - minPadding));
                
                ideaBall.style.left = `${boundedX}px`;
                ideaBall.style.top = `${boundedY}px`;
                this.drawConnections();
            });
        });

        ideaBall.addEventListener('dragend', (e) => {
            if (this.isDragging && this.selectedIdea) {
                const idea = this.ideas.find(i => i.element === this.selectedIdea);
                if (idea) {
                    const lastX = parseInt(this.selectedIdea.style.left);
                    const lastY = parseInt(this.selectedIdea.style.top);
                    const deltaX = lastX - parseInt(this.selectedIdea.style.left);
                    const deltaY = lastY - parseInt(this.selectedIdea.style.top);
                    
                    this.velocities.set(idea, {
                        x: deltaX * 5,
                        y: deltaY * 5
                    });
                }
            }
            this.isDragging = false;
            this.selectedIdea = null;
        });
    }

    drawConnections() {
        const canvas = document.getElementById('connections-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = this.workspace.scrollWidth;
        canvas.height = this.workspace.scrollHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        
        this.connections.forEach(conn => {
            const fromRect = conn.from.element.getBoundingClientRect();
            const toRect = conn.to.element.getBoundingClientRect();
            const workspaceRect = this.workspace.getBoundingClientRect();
            
            const fromX = fromRect.left - workspaceRect.left + this.workspace.scrollLeft + fromRect.width/2;
            const fromY = fromRect.top - workspaceRect.top + this.workspace.scrollTop + fromRect.height/2;
            const toX = toRect.left - workspaceRect.left + this.workspace.scrollLeft + toRect.width/2;
            const toY = toRect.top - workspaceRect.top + this.workspace.scrollTop + toRect.height/2;
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
        });
    }

    addIdea(x, y, text, isAIGenerated = false, isCombined = false) {
        const ideaBall = document.createElement('div');
        ideaBall.className = `idea-ball ${isAIGenerated ? 'ai' : 'main'} ${isCombined ? 'combined' : ''}`;
        ideaBall.style.left = `${x}px`;
        ideaBall.style.top = `${y}px`;
        
        // Set default rating to 0
        ideaBall.dataset.rating = "0";
        
        const textContainer = document.createElement('div');
        textContainer.className = 'idea-ball-inner';
        textContainer.innerHTML = `<p class='idea-ball-text'>${text}</p>`;
        ideaBall.appendChild(textContainer);
        
        ideaBall.draggable = true;

        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn btn-sm generate-btn idea-button';
        generateBtn.innerHTML = '+';
        generateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleGenerateClick(ideaBall, text);
        });
        ideaBall.appendChild(generateBtn);

        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn btn-sm info-btn idea-button';
        infoBtn.innerHTML = 'i';
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showTooltip(ideaBall, text);
        });
        ideaBall.appendChild(infoBtn);

        const mergeBtn = document.createElement('button');
        mergeBtn.className = 'btn btn-sm merge-btn idea-button';
        mergeBtn.innerHTML = '⚡';
        mergeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleMergeMode(ideaBall);
        });
        ideaBall.appendChild(mergeBtn);

        const rateBtn = document.createElement('button');
        rateBtn.className = 'btn btn-sm rate-btn idea-button';
        rateBtn.innerHTML = '⭐';
        rateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRatingInterface(ideaBall);
        });
        ideaBall.appendChild(rateBtn);

        const ratingDisplay = document.createElement('div');
        ratingDisplay.className = 'idea-rating';
        ideaBall.appendChild(ratingDisplay);

        this.setupDragListeners(ideaBall);
        
        this.workspace.appendChild(ideaBall);
        const idea = { element: ideaBall, text: text };
        this.ideas.push(idea);
        this.addToHistory(text);
        return idea;
    }

    async handleGenerateClick(ideaBall, text) {
        try {
            ideaBall.classList.add('generating');
            
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: text })
            });

            const data = await response.json();
            ideaBall.classList.remove('generating');
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = 150;
                
                const idea = this.ideas.find(i => i.element === ideaBall);
                relatedIdeas.forEach((relatedIdea, index) => {
                    const angle = (2 * Math.PI * index) / relatedIdeas.length;
                    const x = parseInt(ideaBall.style.left) + radius * Math.cos(angle);
                    const y = parseInt(ideaBall.style.top) + radius * Math.sin(angle);
                    
                    const newIdea = this.addIdea(x, y, relatedIdea.text, true);
                    this.connectIdeas(idea, newIdea);
                });
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
            ideaBall.classList.remove('generating');
        }
    }

    async handleMergeMode(ideaBall) {
        const idea = this.ideas.find(i => i.element === ideaBall);
        const ideaIndex = this.mergeIdeas.indexOf(idea);
        
        if (ideaIndex === -1) {
            if (this.mergeIdeas.length < 2) {
                this.mergeIdeas.push(idea);
                ideaBall.classList.add('merge-mode');
            }
        } else {
            this.mergeIdeas.splice(ideaIndex, 1);
            ideaBall.classList.remove('merge-mode');
        }
        
        if (this.mergeIdeas.length === 2) {
            this.handleMerge();
        }
    }

    async handleMerge() {
        if (this.mergeIdeas.length !== 2) return;
        
        const idea1 = this.mergeIdeas[0];
        const idea2 = this.mergeIdeas[1];
        
        try {
            idea1.element.classList.add('generating');
            idea2.element.classList.add('generating');
            
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idea: `Combine these two ideas: 1. ${idea1.text} 2. ${idea2.text}`
                })
            });

            const data = await response.json();
            
            if (data.success) {
                const combinedIdeas = JSON.parse(data.data).ideas;
                const x1 = parseInt(idea1.element.style.left);
                const y1 = parseInt(idea1.element.style.top);
                const x2 = parseInt(idea2.element.style.left);
                const y2 = parseInt(idea2.element.style.top);
                
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                
                const newIdea = this.addIdea(midX, midY, combinedIdeas[0].text, false, true);
                
                this.connectIdeas(idea1, newIdea);
                this.connectIdeas(idea2, newIdea);
            }
        } catch (error) {
            console.error('Error merging ideas:', error);
        } finally {
            // Clean up
            idea1.element.classList.remove('generating', 'merge-mode');
            idea2.element.classList.remove('generating', 'merge-mode');
            this.mergeIdeas = [];
        }
    }

    connectIdeas(idea1, idea2) {
        this.connections.push({ from: idea1, to: idea2 });
        this.drawConnections();
    }

    clearWorkspace() {
        this.ideas.forEach(idea => {
            idea.element.remove();
        });
        this.ideas = [];
        this.connections = [];
        this.drawConnections();
    }

    addToHistory(text) {
        // Check if ideas list exists before trying to use it
        if (!this.ideasList) return;

        const li = document.createElement('li');
        li.textContent = text;
        this.ideasList.insertBefore(li, this.ideasList.firstChild);
    }

    showTooltip(ideaBall, text) {
        // If there's an active tooltip and we're clicking the same idea ball
        if (this.activeTooltip && this.activeTooltip._parentIdeaBall === ideaBall) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
            return;
        }

        // Remove any existing tooltip
        if (this.activeTooltip) {
            this.activeTooltip.remove();
            this.activeTooltip = null;
        }

        // Create and show new tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.textContent = text;
        tooltip.style.position = 'absolute';
        tooltip.style.left = '120%';
        tooltip.style.top = '50%';
        tooltip.style.transform = 'translateY(-50%)';
        
        // Store reference to parent idea ball
        tooltip._parentIdeaBall = ideaBall;
        
        ideaBall.appendChild(tooltip);
        this.activeTooltip = tooltip;
    }

    setupHistoryToggle() {
        const toggleBtn = document.getElementById('toggleHistory');
        const historyContent = document.querySelector('.ideas-history');
        
        toggleBtn.addEventListener('click', () => {
            const isVisible = !historyContent.classList.contains('hidden');
            historyContent.classList.toggle('hidden');
            toggleBtn.textContent = isVisible ? 'Show History' : 'Hide History';
        });
    }

    setupRatingSystem() {
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                const rating = parseInt(e.target.dataset.rating);
                this.setRating(rating);
            });
        });
    }

    setRating(rating) {
        this.currentRating = rating;
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            star.classList.toggle('active', starRating <= rating);
        });
    }

    resetModal() {
        document.getElementById('ideaInput').value = '';
        this.setRating(0);
    }

    createIdeaBall(text, x, y) {
        const ideaBall = document.createElement('div');
        ideaBall.className = 'idea-ball';
        
        const innerBall = document.createElement('div');
        innerBall.className = 'idea-ball-inner';
        
        const textElement = document.createElement('p');
        textElement.className = 'idea-ball-text';
        textElement.textContent = text;
        
        // Add rating button
        const rateBtn = document.createElement('button');
        rateBtn.className = 'btn idea-button rate-btn';
        rateBtn.innerHTML = '⭐';
        rateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRatingInterface(ideaBall);
        });

        // Add rating display
        const ratingDisplay = document.createElement('div');
        ratingDisplay.className = 'idea-rating';
        ideaBall.dataset.rating = '0';
        
        innerBall.appendChild(textElement);
        ideaBall.appendChild(innerBall);
        ideaBall.appendChild(rateBtn);
        ideaBall.appendChild(ratingDisplay);
        
        // ... rest of your existing ideaBall setup code ...
        
        return ideaBall;
    }

    showRatingInterface(ideaBall) {
        const currentRating = parseInt(ideaBall.dataset.rating) || 0;
        const previousRating = currentRating;
        
        // Create rating interface
        const ratingInterface = document.createElement('div');
        ratingInterface.className = 'star-rating';
        ratingInterface.style.position = 'absolute';
        ratingInterface.style.bottom = '-30px';
        ratingInterface.style.left = '50%';
        ratingInterface.style.transform = 'translateX(-50%)';
        ratingInterface.style.background = 'rgba(0, 0, 0, 0.8)';
        ratingInterface.style.padding = '5px 10px';
        ratingInterface.style.borderRadius = '15px';
        ratingInterface.style.whiteSpace = 'nowrap';
        ratingInterface.style.display = 'flex';
        ratingInterface.style.alignItems = 'center';
        ratingInterface.style.gap = '10px';
        
        // Create stars container
        const starsContainer = document.createElement('div');
        starsContainer.style.display = 'flex';
        starsContainer.style.gap = '5px';
        
        // Create zero-star option (outlined star)
        const zeroStar = document.createElement('span');
        zeroStar.className = 'star' + (currentRating === 0 ? ' active' : '');
        zeroStar.textContent = '☆';  // Outlined star
        zeroStar.style.cursor = 'pointer';
        zeroStar.title = 'Reset to default';
        zeroStar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setRating(ideaBall, 0);
            ratingInterface.remove();
        });
        starsContainer.appendChild(zeroStar);
        
        // Create stars (1-3)
        const titles = ['Bronze', 'Silver', 'Gold'];
        for (let i = 1; i <= 3; i++) {
            const star = document.createElement('span');
            star.className = 'star' + (i <= currentRating ? ' active' : '');
            star.textContent = '⭐';
            star.style.cursor = 'pointer';
            star.title = titles[i-1];
            
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setRating(ideaBall, i);
                ratingInterface.remove();
            });
            
            starsContainer.appendChild(star);
        }
        
        // Add undo button
        const undoButton = document.createElement('button');
        undoButton.className = 'btn btn-sm btn-outline-secondary';
        undoButton.innerHTML = '↩️';
        undoButton.style.padding = '0px 5px';
        undoButton.style.fontSize = '12px';
        undoButton.title = 'Undo previous rating';
        
        undoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setRating(ideaBall, previousRating);
            ratingInterface.remove();
        });
        
        // Remove existing rating interface if any
        const existingInterface = ideaBall.querySelector('.star-rating');
        if (existingInterface) {
            existingInterface.remove();
        }
        
        // Append everything to the rating interface
        ratingInterface.appendChild(starsContainer);
        ratingInterface.appendChild(undoButton);
        ideaBall.appendChild(ratingInterface);
    }

    setRating(ideaBall, rating) {
        ideaBall.dataset.rating = rating;
        
        // Center the text within the potentially resized ball
        const textContainer = ideaBall.querySelector('.idea-ball-inner');
        if (textContainer) {
            textContainer.style.width = '100%';
            textContainer.style.height = '100%';
            textContainer.style.display = 'flex';
            textContainer.style.alignItems = 'center';
            textContainer.style.justifyContent = 'center';
        }
    }

    saveIdea() {
        const ideaInput = document.getElementById('ideaInput');
        const text = ideaInput.value.trim();
        
        if (text) {
            const ideaBall = this.createIdeaBall(text, this.lastClickX, this.lastClickY);
            this.workspace.appendChild(ideaBall);
            this.ideaModal.hide();
            this.resetModal();
            
            // Add to history with rating
            this.addToHistory(text);
        }
    }
}
