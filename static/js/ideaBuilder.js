document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    const canvasManager = new CanvasManager('ideaCanvas');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const generateIdeasBtn = document.getElementById('generateIdeas');
    const clearCanvasBtn = document.getElementById('clearCanvas');
    let pendingIdeaPosition = null;

    document.addEventListener('canvas-click', function(e) {
        console.log('Canvas click event received:', e.detail);
        pendingIdeaPosition = { x: e.detail.x, y: e.detail.y };
        ideaModal.show();
    });

    document.getElementById('saveIdea').addEventListener('click', function() {
        const ideaInput = document.getElementById('ideaInput');
        const ideaText = ideaInput.value.trim();
        console.log('Save idea clicked:', { ideaText, position: pendingIdeaPosition });
        
        if (ideaText && pendingIdeaPosition) {
            const newIdea = canvasManager.addIdea(
                pendingIdeaPosition.x,
                pendingIdeaPosition.y,
                ideaText
            );
            console.log('New idea created:', newIdea);
            canvasManager.render();
            generateIdeasBtn.disabled = false;
            ideaInput.value = '';
            ideaModal.hide();
            pendingIdeaPosition = null;
        } else {
            console.warn('Cannot save idea: missing text or position');
        }
    });

    generateIdeasBtn.addEventListener('click', async function() {
        const mainIdea = canvasManager.ideas.find(idea => !idea.isAIGenerated);
        console.log('Generate ideas clicked, main idea:', mainIdea);
        
        if (!mainIdea) {
            console.warn('No main idea found for generation');
            return;
        }

        try {
            console.log('Sending request to generate ideas for:', mainIdea.text);
            const response = await fetch('/generate-ideas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idea: mainIdea.text })
            });

            const data = await response.json();
            console.log('Received response:', data);
            
            if (data.success) {
                const relatedIdeas = JSON.parse(data.data).ideas;
                const radius = 150;
                const angleStep = (2 * Math.PI) / relatedIdeas.length;

                relatedIdeas.forEach((idea, index) => {
                    const angle = index * angleStep;
                    const x = mainIdea.x + radius * Math.cos(angle);
                    const y = mainIdea.y + radius * Math.sin(angle);
                    
                    console.log('Creating related idea:', { text: idea.text, x, y });
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
        console.log('Clearing canvas');
        canvasManager.ideas = [];
        canvasManager.connections = [];
        canvasManager.render();
        generateIdeasBtn.disabled = true;
    });

    // Initial render
    canvasManager.render();
});
