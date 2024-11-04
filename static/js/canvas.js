class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id '${canvasId}' not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.ideas = [];
        this.selectedIdea = null;
        this.isDragging = false;
        this.connections = [];
        this.tooltip = this.createTooltip();
        this.isPermanentTooltip = false;
        
        this.setupCanvas();
        this.setupEventListeners();
        
        // Debounce the resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleResize(), 250);
        });
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) {
                this.updateTooltip(e);
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (!this.isPermanentTooltip) {
                this.hideTooltip();
            }
        });

        this.canvas.addEventListener('click', (e) => {
            const idea = this.getIdeaAtPosition(
                e.clientX + this.canvas.parentElement.scrollLeft - this.canvas.parentElement.offsetLeft,
                e.clientY + this.canvas.parentElement.scrollTop - this.canvas.parentElement.offsetTop
            );
            
            if (idea) {
                this.updateTooltip(e, true);
                e.stopPropagation();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.canvas.contains(e.target) && this.isPermanentTooltip) {
                this.hideTooltip();
            }
        });
    }

    // Rest of the methods remain the same...
    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'idea-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
        return tooltip;
    }

    setupCanvas() {
        const workspace = this.canvas.parentElement;
        const availableWidth = workspace.clientWidth;
        const availableHeight = workspace.clientHeight;
        
        // Make canvas at least 2x the viewport size or 3000px, whichever is larger
        this.canvas.width = Math.max(availableWidth * 2, 3000);
        this.canvas.height = Math.max(availableHeight * 2, 3000);
        
        // Center the viewport
        workspace.scrollLeft = (this.canvas.width - availableWidth) / 2;
        workspace.scrollTop = (this.canvas.height - availableHeight) / 2;
    }

    handleResize() {
        const workspace = this.canvas.parentElement;
        const oldWidth = this.canvas.width;
        const oldHeight = this.canvas.height;
        
        // Store scroll positions as percentages
        const scrollXPercent = workspace.scrollLeft / oldWidth;
        const scrollYPercent = workspace.scrollTop / oldHeight;
        
        this.setupCanvas();
        
        // Restore scroll positions
        workspace.scrollLeft = this.canvas.width * scrollXPercent;
        workspace.scrollTop = this.canvas.height * scrollYPercent;
        
        this.render();
    }

    updateTooltip(e, forceShow = false) {
        const idea = this.getIdeaAtPosition(
            e.clientX + this.canvas.parentElement.scrollLeft - this.canvas.parentElement.offsetLeft,
            e.clientY + this.canvas.parentElement.scrollTop - this.canvas.parentElement.offsetTop
        );

        if (idea) {
            this.tooltip.textContent = idea.text;
            this.tooltip.style.display = 'block';

            // Calculate available space
            const tooltipRect = this.tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Default position is to the right and below the cursor
            let left = e.clientX + 10;
            let top = e.clientY + 10;

            // Adjust horizontal position if tooltip would overflow right edge
            if (left + tooltipRect.width > viewportWidth) {
                left = e.clientX - tooltipRect.width - 10;
            }

            // Adjust vertical position if tooltip would overflow bottom edge
            if (top + tooltipRect.height > viewportHeight) {
                top = e.clientY - tooltipRect.height - 10;
            }

            // Ensure tooltip doesn't go off-screen to the left or top
            left = Math.max(10, left);
            top = Math.max(10, top);

            this.tooltip.style.left = `${left}px`;
            this.tooltip.style.top = `${top}px`;

            if (forceShow) {
                this.isPermanentTooltip = true;
            }
        } else if (!this.isPermanentTooltip) {
            this.hideTooltip();
        }
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.isPermanentTooltip = false;
    }

    drawIdea(idea) {
        const radius = 60;
        this.ctx.beginPath();
        this.ctx.arc(idea.x, idea.y, radius, 0, Math.PI * 2);
        
        // Fill with appropriate color
        if (idea.isCombined) {
            this.ctx.fillStyle = 'rgba(186, 85, 211, 0.85)';
        } else if (idea.isAIGenerated) {
            this.ctx.fillStyle = 'rgba(152, 251, 152, 0.85)';
        } else {
            this.ctx.fillStyle = 'rgba(100, 149, 237, 0.85)';
        }
        
        this.ctx.fill();
        
        // Add white border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Draw text
        this.ctx.fillStyle = idea.isAIGenerated ? '#333' : '#fff';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Text wrapping
        const words = idea.text.split(' ');
        let line = '';
        let lines = [];
        const maxWidth = radius * 1.5;
        
        for (let word of words) {
            const testLine = line + word + ' ';
            const metrics = this.ctx.measureText(testLine);
            if (metrics.width > maxWidth && line !== '') {
                lines.push(line);
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        
        // Limit to 3 lines and add ellipsis if needed
        if (lines.length > 3) {
            lines = lines.slice(0, 3);
            lines[2] = lines[2].trim() + '...';
        }
        
        // Draw each line
        const lineHeight = 20;
        const startY = idea.y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
            this.ctx.fillText(line.trim(), idea.x, startY + (i * lineHeight));
        });
    }

    drawConnections() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;

        this.connections.forEach(conn => {
            this.ctx.beginPath();
            this.ctx.moveTo(conn.from.x, conn.from.y);
            this.ctx.lineTo(conn.to.x, conn.to.y);
            this.ctx.stroke();
        });
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawConnections();
        this.ideas.forEach(idea => this.drawIdea(idea));
    }

    addIdea(x, y, text, isAIGenerated = false, isCombined = false) {
        const idea = { x, y, text, isAIGenerated, isCombined };
        this.ideas.push(idea);
        
        // Center viewport on new idea
        const workspace = this.canvas.parentElement;
        workspace.scrollLeft = x - workspace.clientWidth / 2;
        workspace.scrollTop = y - workspace.clientHeight / 2;
        
        this.render();
        return idea;
    }

    getIdeaAtPosition(x, y) {
        const clickRadius = 60;
        return this.ideas.find(idea => {
            const dx = idea.x - x;
            const dy = idea.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= clickRadius;
        });
    }

    connectIdeas(idea1, idea2) {
        this.connections.push({ from: idea1, to: idea2 });
        this.render();
    }
}
