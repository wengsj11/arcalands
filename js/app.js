var stats = null;

var arca = null;
    
var ratio = 4 / 3, // containerWidth / containerHeight
    width = null, // containerWidth
    height = null; // containerHeight

var renderer = null,
    scene = null,
    camera = null,
    cube = null,
    animating = null,
    targetLight = null,
    ballPlane = null;
    
var muted = false;
    
var wallSize = {
    x: 1600,
    y: 1200,
    z: 1000
};
    
var mousePressed = false,
    touchPressed = false;

// things loaded
var loaded = {},
    allLoaded = false;

$(document).ready(function() {
    resize();
        
    // stats
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);
    
    // renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.shadowMapEnabled = true;
    renderer.autoClear = false;
    renderer.setClearColor(0x000000);
    $('#container').append(renderer.domElement);
    
    // scene
    scene = new THREE.Scene();
    modelScene = new THREE.Scene();
    
    // camera
    cameraNear = 600 * Math.sqrt(3);
    cameraFar = cameraNear + wallSize.z;
    camera = new THREE.PerspectiveCamera(60, ratio, cameraNear, cameraFar);
    camera.position.set(0, 0, cameraNear);
    scene.add(camera);
    
    // light
    var light = new THREE.PointLight(0xffffff);
    scene.add(light);
    
    arca = new ArcaLands();
    
    // walls
    var wallPos = [new THREE.Vector3(wallSize.x / 2, 0, -wallSize.z / 2), 
                   new THREE.Vector3(0, -wallSize.y / 2, -wallSize.z / 2), 
                   new THREE.Vector3(-wallSize.x / 2, 0, -wallSize.z / 2), 
                   new THREE.Vector3(0, wallSize.y / 2, -wallSize.z / 2)];
    var wallRot = [new THREE.Vector3(0, -Math.PI / 2, 0),
                   new THREE.Vector3(-Math.PI / 2, 0, 0),
                   new THREE.Vector3(0, Math.PI / 2, 0),
                   new THREE.Vector3(Math.PI / 2, 0, 0)]
    arca.walls = [];
    var wallMap = THREE.ImageUtils.loadTexture('image/wall.jpg');
    for (var i = 0; i < 4; ++i) {
        var x = (i % 2) ? wallSize.x : wallSize.z;
        var y = (i % 2) ? wallSize.z : wallSize.y;
        arca.walls[i] = new THREE.Mesh(
                new THREE.PlaneGeometry(x, y), 
                new THREE.MeshLambertMaterial({
                    map: wallMap,
                    side: THREE.DoubleSide
        }));
        arca.walls[i].position = wallPos[i];
        arca.walls[i].rotation = wallRot[i];
        scene.add(arca.walls[i]);
    }
    // farthest wall
    arca.walls[4] = new THREE.Mesh(
            new THREE.PlaneGeometry(wallSize.x, wallSize.y),
            new THREE.MeshLambertMaterial({
                map: wallMap
            })
    );
    arca.walls[4].position.set(0, 0, -wallSize.z);
    scene.add(arca.walls[4]);
    
    // light when hit targets
    targetLight = new THREE.PointLight(0xff0000, 0.0, 1000);
    scene.add(targetLight);
    
    // create targets
    arca.startGame();
    
    // targets
    initTargets();
    
    // board
    arca.board.mesh = new THREE.Mesh(new THREE.CubeGeometry(
            arca.board.size.x, arca.board.size.y, arca.board.size.z),
            new THREE.MeshLambertMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.8
            })
    );
    arca.board.mesh.position = arca.board.position;
    scene.add(arca.board.mesh);
    
    addMouseHandler();
    
    initDom();
    initSound();
    
    loadModel();
});

function run() {
    stats.begin();
    
    arca.update();
    
    renderer.clear();
    renderer.render(scene, camera);
    
    stats.end();
    
    requestAnimationFrame(run);
}

function resize() {
    width = $(window).width();
    height = $(window).height();
    if (width / height > ratio) {
        width = height * ratio;
    } else {
        height = width / ratio;
    }

    $('#container').css({width: width, height: height});
    if (renderer) {
        renderer.setSize(width, height);
    }
}

function addMouseHandler() {
    $(window).resize(resize);
    
    mousePressed = false;
    var dom = renderer.domElement;
    var cx = width;
    var cy = height;
    
    dom.addEventListener('mousedown', function(e) {
        e.preventDefault();
        
        mousePressed = true;
    }, false);
    
    dom.addEventListener('mouseup', function(e) {
        e.preventDefault();
        
        if (allLoaded && arca.ball.status === 
                Ball.prototype.Status.BEFORE_START) {
            arca.ball.release();
        }
        
        mousePressed = false;
    }, false);
    
    dom.addEventListener('mousemove', function(e) {
        e.preventDefault();
        
        if (allLoaded && arca.gameStatus !== arca.GameStatus.PAUSED) {
            arca.board.move(e.pageX - parseInt($('#container')
                    .css('margin-left')), e.pageY, cx, cy);
        }
    }, false);
}

function initDom() {
    var w = $(window).width();
    var h = $(window).height();
    // game over label
    var padding = parseInt($('#gameOver').css('padding'));
    $('#gameOver').css({
        left: (w - parseInt($('#gameOver').css('width'))) / 2 - padding,
        top: (h - parseInt($('#gameOver').css('height'))) / 2 - padding
    }).click(function() {
        if (arca.gameStatus !== ArcaLands.prototype.GameStatus.GAME_OVER) {
            $('#gameOver').fadeOut();
        }
        arca.startGame();
        initTargets();
    });
    
    // pause
    $('#pause').click(function() {
        pauseToggle();
    });
    
    // credits
    $('#credits').click(function() {
        $('#creditsPanel').fadeToggle();
    });
    $('#creditsPanel').css({
        left: (w - parseInt($('#creditsPanel').css('width'))) / 2 - padding,
        top: (h - parseInt($('#creditsPanel').css('height'))) / 2 - padding
    }).click(function() {
        $('#creditsPanel').fadeOut();
    });
}

function initSound() {
    // sound effects
    var types = ['wood', 'metal', 'stone', 'break', 'wall', 'board'];
    for (var i in types) {
        $('#' + types[i]).jWebAudio('addSoundSource', {
            url: 'sound/' + types[i] + '.ogg',
            preLoad: true,
            callback: function(name) {
                return function() {
                    $('#' + name).data('effectId', 
                            $('#' + name).jWebAudio('effect', '3d'));
                    loaded[name] = true;
                    $('#' + name).data('volume', 200); 
                };
            }(types[i]),
            multishot: true,
            volume: 200
        });
    }
    
    // sweep sound that moves with ball
    $('#sweep').jWebAudio('addSoundSource', {
        url: 'sound/sweep.ogg',
        preLoad: true,
        callback: function() {
            $('#sweep').data('effectId', $('#sweep').jWebAudio('effect', '3d'));
            $('#sweep').data('volume', 100);
            $('#sweep').jWebAudio('play');
            loaded.sweep = true;
        },
        loop: true,
        volume: 100
    });
    
    // background music
    $('#background').jWebAudio('addSoundSource', {
        url: 'sound/background.ogg',
        preLoad: true,
        loop: true,
        callback: function() {
            $('#background').jWebAudio('play');
            loaded.background = true;
        },
        volume: 20
    });
    
    // mute button
    $('#mute').click(function() {
        muted = !muted;
        $('.sound').jWebAudio('options', {
            muted: muted
        });
        if (muted) {
            $(this).text('Unmute')
                    .css('background-color', '#f60');
        } else {
            $(this).text('Mute')
                    .css('background-color', '#ff6');
        }
    });
    
    // game win
    $('#gameWin').jWebAudio('addSoundSource', {
        url: 'sound/win.ogg',
        preLoad: true,
        multishot: true,
        callback: function() {
            loaded.gameWin = true;
            $('#gameWin').data('volume', 100);
            $('#gameWin').data('effectId', 
                    $('#gameWin').jWebAudio('effect', '3d'));
        }
    });
    // game lose
    $('#gameLose').jWebAudio('addSoundSource', {
        url: 'sound/lose.ogg',
        preLoad: true,
        multishot: true,
        callback: function() {
            loaded.gameLose = true;
            $('#gameLose').data('volume', 100);
            $('#gameLose').data('effectId', 
                    $('#gameLose').jWebAudio('effect', '3d'));
        }
    });
}

function initTargets() {
    for (var i in arca.targets) {
        var url = arca.targets[i].mapUrl;
        // materials
        if (url) {
            var map = THREE.ImageUtils.loadTexture(url);
            var material = new THREE.MeshPhongMaterial({
                map: map
            });
            arca.targets[i].mesh = new THREE.Mesh(
                    new THREE.CubeGeometry(arca.targets[i].size.x, 
                            arca.targets[i].size.y, arca.targets[i].size.z), 
                    material);
        } else {
            arca.targets[i].mesh = new THREE.Mesh(
                    new THREE.CubeGeometry(arca.targets[i].size.x, 
                            arca.targets[i].size.y, arca.targets[i].size.z), 
                    new THREE.MeshLambertMaterial({
                        color: colors[Math.ceil(Math.random() 
                                * (colors.length - 1))]
                    }));
        }
        arca.targets[i].mesh.position = arca.targets[i].position;
        scene.add(arca.targets[i].mesh);
    }
}

function pauseToggle() {
    if (arca.gameStatus === arca.GameStatus.IN_GAME) {
        $('#container').css('cursor', 'auto');
        $('#pause').text('Continue').css('background-color', '#f60');
        
        arca.gameStatus = arca.GameStatus.PAUSED;
        
    } else if (arca.gameStatus === arca.GameStatus.PAUSED) {
        $('#container').css('cursor', 'none');
        $('#pause').text('Pause').css('background-color', '#ff6');
        
        arca.gameStatus = arca.GameStatus.IN_GAME;
    }
}

function loadModel() {
    var loader = new THREE.OBJMTLLoader();
    loader.addEventListener('load', function(event) {
        // ball
        arca.ball.mesh = event.content;
        arca.ball.mesh.position = arca.ball.position;
        arca.ball.mesh.scale.set(15, 15, 15);
        arca.ball.mesh.rotation.x = Math.PI / 2;
        scene.add(arca.ball.mesh);
        // light following ball
        var ballLight = new THREE.PointLight(0x00ff00, 2.0, 500);
        ballLight.position = arca.ball.position;
        scene.add(ballLight);
        
        // ball plane to show ball position
        /*ballPlane = new THREE.Mesh(
                new THREE.CubeGeometry(wallSize.x, wallSize.y, 5),
                new THREE.MeshLambertMaterial({
                    color: 0x66ff00,
                    transparent: true,
                    opacity: 0.2
                })
        );
        ballPlane.position.z = arca.ball.position.z + arca.ball.size.z / 2;
        scene.add(ballPlane);
        */
        
        checkLoaded();
    });
    loader.load('model/machine.obj', 'model/machine.mtl');
}

var checkHandle = null;
function checkLoaded() {
    if (!allLoaded) {
        allLoaded = true;
        $('.sound').each(function() {
            if (!loaded[$(this).attr('id')]) {
                allLoaded = false;
            }
        });
        if (allLoaded) {
            clearInterval(checkHandle);
            
            // start game
            allLoaded = true;
            // show game panel
            $('#loading').hide();
            $('#gamePanel').fadeIn();
            
            run();
        } else {
            // check later
            checkHandle = setInterval(checkLoaded, 500);
        }
    }
}
