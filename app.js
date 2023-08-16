/* Vars */
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

// Grid
const cellSize = 20; // Tamanho da célula da grade
const gridSizeX = Math.ceil(canvas.width / cellSize);
const gridSizeY = Math.ceil(canvas.height / cellSize);

// Path inicial
const path = [
    {
        x: 200,
        y: 221,
    },
    {
        x: 254,
        y: 458,
    },
    {
        x: 528,
        y: 424,
    },
    {
        x: 552,
        y: 148,
    },
];

// Caminho único
const pathGoogleMaps = [];

const DRONES_ENERGY = 1300;
let dronePathIndex = 0; // Índice atual no caminho

let isDrawing = false;
let isMovingForward = true;

// Drone infos
const chargeDuration = 300; // Tempo de recarga em quadros
const droneCoverage = 5; // Quantidade de quadrados monitorados por cada drone
const enemies = [];
const newDroneDelay = 50; // Tempo para criar um novo drone em quadros
let chargeStations = [{ x: 300, y: 50, radius: 20 }];
let drones = [];

// Google Maps
const addressInput = document.getElementById('addressInput');
const mapDiv = document.getElementById('map');
const searchButton = document.getElementById('searchButton');

// TODO doing Enemy
class Enemy {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.isAlive = true;
    }

    moveTowards(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.speed) {
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
        }
    }
}

// Buttons
const createDroneButton = document.getElementById('createDroneButton');
createDroneButton.addEventListener('click', () => {
    const totalDrones = drones.length;
    const station = chargeStations[totalDrones % chargeStations.length];
    createDrone(station.x, station.y);

    // Recalcular segmentos para todos os drones
    for (const drone of drones) {
        drone.segments = null;
        drone.segmentIndex = undefined;
    }
});

canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    path.push({ x: mouseX, y: mouseY });

    if (path.length >= 3) {
        isDrawing = false;
        // Verificar se o desenho é um circuito fechado
        const firstPoint = path[0];
        const lastPoint = path[path.length - 1];
        const distance = calculateDistance(firstPoint.x, firstPoint.y, lastPoint.x, lastPoint.y);
        if (distance <= 20) {
            // Distância de fechamento ajustável
            isMovingForward = true;

            // Iniciar ataque dos inimigos
            createEnemies();
            // Calcular a quantidade de drones necessários
            calculateRequiredDrones();
        }
    }
});

document.getElementById('clearButton').addEventListener('click', () => {
    path.length = 0;
    drones = [];
    enemies.length = 0;
    isDrawing = false;
    chargeStations = [{ x: 300, y: 50, radius: 20 }];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawCanvas();
    updateEnergyInfo();
});

canvas.addEventListener('contextmenu', event => {
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    chargeStations.push({ x: mouseX, y: mouseY, radius: 20 });
    redrawCanvas();
});

/* Utils */
function updateEnergyInfo() {
    const energyInfo = document.getElementById('energyInfo');
    energyInfo.innerHTML = '';
    if (drones?.length <= 0) {
        energyInfo.innerHTML = 'Sem drones no momento!';
    }

    for (const drone of drones) {
        energyInfo.innerHTML += drone.isCharging
            ? `Drone: Recarregando... <br>`
            : `Drone Energia: ${drone.energy}<br>`;
    }
}

function createDrone(x, y) {
    drones.push({ x, y, energy: DRONES_ENERGY, speed: 2 }); // Adicionei a propriedade 'speed'
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function getLatLngFromPixel(x, y, map) {
    const bounds = map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const projection = map.getProjection();

    const topRight = projection.fromLatLngToPoint(ne);
    const bottomLeft = projection.fromLatLngToPoint(sw);

    const scale = Math.pow(2, map.getZoom());
    const worldPoint = new google.maps.Point(
        x / scale + bottomLeft.x,
        y / scale + topRight.y + 0.2
    );
    const latLng = projection.fromPointToLatLng(worldPoint);

    return latLng;
}

// Inicializar o mapa do google maps
function initMap() {
    const map = new google.maps.Map(mapDiv, {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8,
    });
    searchButton.addEventListener('click', () => {
        const geocoder = new google.maps.Geocoder();
        const address = addressInput.value;

        geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location;
                map.setCenter(location);
            }
        });
    });

    // Google MAPS
    canvas.addEventListener('click', event => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const latLng = getLatLngFromPixel(x, y, map);

        if ((latLng, map)) {
            const lat = latLng.lat();
            const lng = latLng.lng();

            pathGoogleMaps.push({ lat, lng });

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();

            const pathCoordinates = pathGoogleMaps.map(
                point => new google.maps.LatLng(point.lat, point.lng)
            );
            /*
            // TODO pegando os clicks do canvas e desenhando no google maps pegando Lat e Log
            const pathPolyline = new google.maps.Polyline({
                path: pathCoordinates,
                geodesic: true,
                strokeColor: '#FF0000',
                strokeOpacity: 1.0,
                strokeWeight: 2,
            });
            console.log('pathCoordinates >> ', pathCoordinates);
            pathPolyline.setMap(map);
            */
        }
    });
}

/* Draw */
function drawGrid() {
    ctx.beginPath();
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += cellSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += cellSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)'; // Grid fundo mais transparente >> p/ voltar grid ultima casa 0.1
    ctx.stroke();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha Grid
    drawGrid();

    // Desenhar estações de recarga
    for (const station of chargeStations) {
        var heightImg = 90;
        var widthImg = 90;
        var svgStationImg = document.getElementById('stationPower');
        ctx.drawImage(
            svgStationImg,
            station.x - widthImg / 3,
            station.y - heightImg / 3,
            widthImg,
            heightImg
        );
    }

    // Desenha o Caminho forma (Linhas)
    ctx.beginPath();
    ctx.fillStyle = 'blue';
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 5; // Aumentar a espessura da linha para 5 pixels
    if (path.length > 0) {
        ctx.setLineDash([10, 15]);
        ctx.moveTo(path[0].x, path[0].y);
        for (const point of path) {
            ctx.lineTo(point.x, point.y);
        }
        ctx.closePath(); // Fechar a forma geométrica
    }
    ctx.stroke();

    // Desenha intersecões clicadas pelo USER (FEEDBACK USER)
    ctx.fillStyle = 'red';
    for (const pathPoint of path) {
        ctx.beginPath();
        ctx.fillRect(pathPoint.x - 5, pathPoint.y - 5, 10, 10);
        ctx.fill();
    }
    ctx.stroke();

    // Desenha os drones
    for (const drone of drones) {
        if (drone) {
            var heightImg = 45;
            var widthImg = 45;
            var svgDroneImg = document.getElementById('drone');
            ctx.drawImage(
                svgDroneImg,
                drone.x - widthImg / 3,
                drone.y - heightImg / 3,
                widthImg,
                heightImg
            );
        }
    }

    ctx.beginPath();
    ctx.fillStyle = 'yellow';
    for (const enemy of enemies) {
        if (enemy.isAlive) {
            ctx.fillRect(enemy.x - 5, enemy.y - 5, 10, 10);
            ctx.fill();
        }
    }
    ctx.stroke();

    updateEnergyInfo();
    requestAnimationFrame(redrawCanvas);
}

// TODO Doing enemies... (for test drones monitoring)
function createEnemies() {
    for (let i = 0; i < path.length; i++) {
        const point = path[i];
        if (i % 10 === 0) {
            // Criar inimigo a cada 10 pontos
            const enemyX = point.x + (Math.random() - 0.5) * 40;
            const enemyY = point.y + (Math.random() - 0.5) * 40;
            enemies.push(new Enemy(enemyX, enemyY, 1));
        }
    }
}

function updateEnemies() {
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];

        if (enemy && enemy.isAlive) {
            const drone = drones[i % drones.length];

            if (drone && drone.energy > 0) {
                enemy.moveTowards(drone.x, drone.y);

                const distanceToDrone = calculateDistance(enemy.x, enemy.y, drone.x, drone.y);
                if (distanceToDrone < 10) {
                    // Se pegou enimigo no campo de visão excluir enemy
                    drone.x = chargeStations[0].x;
                    drone.y = chargeStations[0].y;
                }
            }
        }
    }

    requestAnimationFrame(updateEnemies);
}

updateDrones();
updateEnemies();
redrawCanvas();
