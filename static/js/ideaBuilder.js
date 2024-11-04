document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    const ideaManager = new IdeaManager('idea-workspace');
    const ideaModal = new bootstrap.Modal(document.getElementById('ideaModal'));
    const clearCanvasBtn = document.getElementById('clearCanvas');
    const combineIdeasBtn = document.getElementById('combineIdeasBtn');
    const startTimerBtn = document.getElementById('startTimer');
    const pauseTimerBtn = document.getElementById('pauseTimer');
    const timerInput = document.getElementById('timerInput');
    let pendingIdeaPosition = null;

    // ... [previous event listeners]

    timerInput.addEventListener('change', function() {
        const value = parseInt(this.value);
        if (value < 1) this.value = 1;
        if (value > 3600) this.value = 3600;  // Max 1 hour
    });

    // ... [rest of the ideaBuilder.js code remains the same]
});
