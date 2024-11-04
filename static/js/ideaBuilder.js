document.addEventListener('DOMContentLoaded', function() {
    const canvasManager = new CanvasManager('ideaCanvas');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const generateIdeasBtn = document.getElementById('generateIdeas');
    const clearCanvasBtn = document.getElementById('clearCanvas');
    let pendingIdeaPosition = null;

    document.addEventListener('canvas-click', function(e) {
        pendingIdeaPosition = { x: e.detail.x, y: e.detail.y };
        ideaModal.show();
    });

    document.getElementById('saveIdea').addEventListener('click', function() {
        const ideaText = document.getElementById('ideaInput').value.trim();
        if (ideaText && pendingIdeaPosition) {
            const newIdea = canvasManager.addIdea(
                pendingIdeaPosition.x,
                pendingIdeaPosition.y,
                ideaText
            );
            canvasManager.render();
            generateIdeasBtn.disabled = false;
            document.getElementById('ideaInput').value = '';
            ideaModal.hide();
        }
    });

    generateIdeasBtn.addEventListener('click', async function() {
        const mainIdea = canvasManager.ideas.find(idea => !idea.isAIGenerated);
        if (!mainIdea) return;

        try {
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: mainIdea.text })
            });

            const data = await response.json();
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = 150;
                const angleStep = (2 * Math.PI) / relatedIdeas.length;

                relatedIdeas.forEach((idea, index) => {
                    const angle = index * angleStep;
                    const x = mainIdea.x + radius * Math.cos(angle);
                    const y = mainIdea.y + radius * Math.sin(angle);
                    
                    const newIdea = canvasManager.addIdea(x, y, idea.text, true);
                    canvasManager.connectIdeas(mainIdea, newIdea);
                });

                canvasManager.render();
                generateIdeasBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error generating ideas:', error);
        }
    });

    clearCanvasBtn.addEventListener('click', function() {
        canvasManager.ideas = [];
        canvasManager.connections = [];
        canvasManager.render();
        generateIdeasBtn.disabled = true;
    });

    // Initial render
    canvasManager.render();
});
