// Angry Bird Runner (Obstacle) using Matter.js
(function () {
    const { Engine, Render, Runner, World, Bodies, Body, Composite, Events } = Matter;

    // Canvas setup
    const canvas = document.getElementById('game');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Physics engine
    const engine = Engine.create();
    engine.gravity.y = 0.5;

    const render = Render.create({
        engine,
        canvas,
        options: {
            width,
            height,
            pixelRatio: dpr,
            wireframes: false,
            background: 'transparent'
        }
    });
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    const world = engine.world;

    // Boundaries
    const ground = Bodies.rectangle(width / 2, height - 20, width * 2, 40, {
        isStatic: true,
        label: 'ground',
        render: { fillStyle: '#6ab04c' }
    });
    const ceiling = Bodies.rectangle(width / 2, -20, width * 2, 40, {
        isStatic: true,
        label: 'ceiling',
        render: { fillStyle: 'transparent' }
    });
    World.add(world, [ground, ceiling]);

    // Assets
    const assets = {
        bird: new Image(),
        pipe: new Image()
    };
    assets.bird.src = 'bird.png';
    assets.pipe.src = 'ong.jpg';

    // Bird
    let bird = null;
    const birdRadius = 20;

    function spawnBird() {
        if (bird) Composite.remove(world, bird);
        bird = Bodies.circle(160, height / 2, birdRadius, {
            label: 'bird',
            restitution: 0.0,
            frictionAir: 0.015,
            render: { sprite: { texture: assets.bird.src, xScale: (birdRadius * 2) / 41, yScale: (birdRadius * 2) / 63 } }
        });
        World.add(world, bird);
    }

    // Obstacles (pipes-like)
    let obstacles = [];
    let lastSpawnX = 0;
    const obstacleSpeed = 4; // px per frame (approx at 60fps)
    const minGap = 150;
    const maxGap = 220;
    const minSpacing = 320;
    const maxSpacing = 420;

    function randIn(min, max) { return Math.random() * (max - min) + min; }

    function createObstaclePair(spawnX) {
        const gap = randIn(minGap, maxGap);
        const centerY = randIn(160, height - 200);
        const thickness = 60;
        const topHeight = Math.max(40, centerY - gap / 2);
        const bottomY = centerY + gap / 2 + (height - (centerY + gap / 2)) / 2;
        const bottomHeight = Math.max(40, height - (centerY + gap / 2) - 40);

        const top = Bodies.rectangle(spawnX, topHeight / 2, thickness, topHeight, {
            isStatic: true,
            label: 'obstacle',
            render: { sprite: { texture: assets.pipe.src, xScale: thickness / 21, yScale: topHeight / 81 } }
        });
        const bottom = Bodies.rectangle(spawnX, height - bottomHeight / 2 - 20, thickness, bottomHeight, {
            isStatic: true,
            label: 'obstacle',
            render: { sprite: { texture: assets.pipe.src, xScale: thickness / 21, yScale: bottomHeight / 81 } }
        });

        const pair = { top, bottom, passed: false };
        obstacles.push(pair);
        World.add(world, [top, bottom]);
    }

    function resetObstacles() {
        obstacles.forEach(p => {
            Composite.remove(world, p.top);
            Composite.remove(world, p.bottom);
        });
        obstacles = [];
        lastSpawnX = width + 200;
        // spawn initial obstacles
        for (let i = 0; i < 3; i++) {
            createObstaclePair(lastSpawnX);
            lastSpawnX += randIn(minSpacing, maxSpacing);
        }
    }

    // Game state
    let state = 'start'; // start | play | over
    let score = 0;

    function setScore(val) {
        score = val;
        document.getElementById('score').textContent = String(score);
    }

    function startGame() {
        state = 'play';
        document.querySelector('.help').textContent = 'Nhấn Space/Chuột để bay lên. Tránh chướng ngại vật!';
        setScore(0);
        spawnBird();
        resetObstacles();
    }

    function gameOver() {
        if (state === 'over') return;
        state = 'over';
        document.querySelector('.help').textContent = 'Thua rồi! Nhấn Chơi lại để thử lại.';
        // stop bird horizontal drift
        Body.setVelocity(bird, { x: 0, y: bird.velocity.y });
    }

    // Update loop: move obstacles, check scoring, collisions implicitly by Matter
    Events.on(engine, 'beforeUpdate', function () {
        if (state !== 'play') return;

        // Keep bird roughly at same x (no forward motion) for simplicity
        Body.setPosition(bird, { x: 160, y: bird.position.y });

        // Move obstacles left
        obstacles.forEach(pair => {
            const dx = -obstacleSpeed;
            Body.translate(pair.top, { x: dx, y: 0 });
            Body.translate(pair.bottom, { x: dx, y: 0 });

            // Score when passed
            if (!pair.passed && pair.top.position.x + 30 < bird.position.x - birdRadius) {
                pair.passed = true;
                setScore(score + 1);
            }
        });

        // Recycle obstacles and spawn new ones
        obstacles = obstacles.filter(pair => {
            const out = pair.top.position.x < -100;
            if (out) {
                Composite.remove(world, pair.top);
                Composite.remove(world, pair.bottom);
            }
            return !out;
        });

        // Ensure enough obstacles ahead (safe single-spawn per tick)
        let farthestX = obstacles.length ? Math.max(...obstacles.map(p => p.top.position.x)) : 160;
        if (farthestX < width + 300) {
            const spawnX = Math.max(width + 300, farthestX + randIn(minSpacing, maxSpacing));
            lastSpawnX = spawnX;
            createObstaclePair(spawnX);
        }
    });

    // Collisions -> game over when hitting obstacle or ground/ceiling
    Events.on(engine, 'collisionStart', function (evt) {
        if (state !== 'play') return;
        for (const pair of evt.pairs) {
            const labels = [pair.bodyA.label, pair.bodyB.label];
            if (labels.includes('obstacle') || labels.includes('ground') || labels.includes('ceiling')) {
                gameOver();
                break;
            }
        }
    });

    // Controls: space or mouse to flap
    function flap() {
        if (state === 'start') {
            startGame();
        }
        if (state !== 'play') return;
        Body.setVelocity(bird, { x: 0, y: -4 });
        Body.setAngularVelocity(bird, 0);
    }
    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            flap();
        }
    });
    window.addEventListener('mousedown', flap);
    window.addEventListener('touchstart', function (e) { e.preventDefault(); flap(); }, { passive: false });

    // Buttons - Add both click and touch events for mobile compatibility
    function handleReset() {
        state = 'start';
        document.querySelector('.help').textContent = 'Nhấn Bắt đầu, sau đó Space/Chuột để bay.';
        setScore(0);
        spawnBird();
        resetObstacles();
    }
    
    function handleStart() {
        if (state === 'play') return; // avoid double start
        startGame();
    }
    
    const resetBtn = document.getElementById('resetBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Add click events
    resetBtn.addEventListener('click', handleReset);
    nextBtn.addEventListener('click', handleStart);
    
    // Add touch events for mobile
    resetBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleReset();
    }, { passive: false });
    
    nextBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleStart();
    }, { passive: false });

    // Resize
    function onResize() {
        width = window.innerWidth;
        height = window.innerHeight;
        render.canvas.width = width * dpr;
        render.canvas.height = height * dpr;
        render.canvas.style.width = width + 'px';
        render.canvas.style.height = height + 'px';
        render.options.width = width;
        render.options.height = height;
        // Update boundaries
        Body.setPosition(ground, { x: width / 2, y: height - 20 });
        Body.setVertices(ground, Bodies.rectangle(width / 2, height - 20, width * 2, 40).vertices);
        Body.setPosition(ceiling, { x: width / 2, y: -20 });
        Body.setVertices(ceiling, Bodies.rectangle(width / 2, -20, width * 2, 40).vertices);
    }
    window.addEventListener('resize', onResize);
    onResize();

    // Initial state
    document.querySelector('.help').textContent = 'Nhấn Bắt đầu, sau đó Space/Chuột để bay. Tránh chướng ngại vật!';
    setScore(0);
    spawnBird();
    resetObstacles();
})();


