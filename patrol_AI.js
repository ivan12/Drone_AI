function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateDrones() {
    // Contar o número de drones em cada lado
    const sideCounts = new Array(path.length).fill(0);

    for (const drone of drones) {
        if (drone.segmentIndex !== undefined) {
            sideCounts[drone.segmentIndex]++;
        }
    }

    for (let i = 0; i < drones.length; i++) {
        const drone = drones[i];

        if (drone && drone.energy > DRONES_ENERGY / 3) {
            if (!drone.segments) {
                // Dividir o caminho em segmentos para cada lado da figura
                const pathSegments = calculatePathSegments(path);
                drone.segments = pathSegments;

                // Encontrar o lado com menos drones e atribuir a esse lado
                let minSideCount = sideCounts[0];
                let minSideIndex = 0;
                for (let j = 1; j < sideCounts.length; j++) {
                    if (sideCounts[j] < minSideCount) {
                        minSideCount = sideCounts[j];
                        minSideIndex = j;
                    }
                }

                drone.segmentIndex = minSideIndex;
                sideCounts[minSideIndex]++;
            }

            // Gerencia codigo de movimento
            const currentSegment = drone.segments[drone.segmentIndex];
            if (currentSegment) {
                // Verificar se o segmento atual é válido
                const targetX = currentSegment.end.x;
                const targetY = currentSegment.end.y;

                const dx = targetX - drone.x;
                const dy = targetY - drone.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > drone.speed) {
                    const angle = Math.atan2(dy, dx);
                    drone.x += Math.cos(angle) * drone.speed;
                    drone.y += Math.sin(angle) * drone.speed;
                    drone.energy -= 1;
                } else {
                    drone.x = targetX; // Corrigindo a posição para o ponto exato do segmento
                    drone.y = targetY; // Corrigindo a posição para o ponto exato do segmento
                    drone.segmentIndex = (drone.segmentIndex + 1) % drone.segments.length;
                }
                ctx.fillStyle = currentSegment.color; // Definir cor aleatória para o drone
                ctx.beginPath();
                ctx.arc(drone.x, drone.y, 10, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            const nearestStation = findNearestChargeStation(drone.x, drone.y);
            const distanceToStation = calculateDistance(
                drone.x,
                drone.y,
                nearestStation.x,
                nearestStation.y
            );

            if (distanceToStation <= drone.speed && !drone.isCharging) {
                drone.isCharging = true;
                drone.chargeTimer = chargeDuration;
            } else {
                const angle = Math.atan2(nearestStation.y - drone.y, nearestStation.x - drone.x);
                drone.x += Math.cos(angle) * drone.speed;
                drone.y += Math.sin(angle) * drone.speed;
            }
        }
        droneIsCharging(drone);
    }

    requestAnimationFrame(updateDrones);
}

function findNearestChargeStation(x, y) {
    let nearestStation = chargeStations[0];
    let shortestDistance = calculateDistance(x, y, nearestStation.x, nearestStation.y);

    for (let i = 1; i < chargeStations.length; i++) {
        const distance = calculateDistance(x, y, chargeStations[i].x, chargeStations[i].y);
        if (distance < shortestDistance) {
            nearestStation = chargeStations[i];
            shortestDistance = distance;
        }
    }
    return nearestStation;
}

function calculateDronesSegments() {
    const totalDrones = drones.length;
    const pathLength = path.length;
    const segmentLength = Math.ceil(pathLength / totalDrones);

    for (let i = 0; i < totalDrones; i++) {
        const startIndex = i * segmentLength;
        const endIndex = (i + 1) * segmentLength;
        drones[i].segment = path.slice(startIndex, endIndex);
        drones[i].segmentIndex = 0;
    }
}

function calculateRequiredDrones() {
    const totalSquares = Math.ceil(canvas.width / cellSize) * Math.ceil(canvas.height / cellSize);
    const totalDrones = Math.ceil(totalSquares / droneCoverage);
    if (totalDrones > drones.length) {
        const existingDrones = drones.length;
        for (let i = existingDrones; i < totalDrones; i++) {
            const station = chargeStations[i % chargeStations.length];
            // createDrone(station.x, station.y);
        }
    }
}

function calculatePathSegments(path) {
    const segments = [];

    for (let i = 0; i < path.length; i++) {
        const start = path[i];
        const end = path[(i + 1) % path.length]; // Próximo ponto no caminho
        segments.push({ start, end, color: getRandomColor() });
    }

    return segments;
}

function droneIsCharging(drone) {
    if (drone.isCharging) {
        drone.chargeTimer--;
        if (drone) {
            // Rederizar o drone mesmo durante a recarga
            ctx.fillStyle = 'gray';
            ctx.beginPath();
            ctx.arc(drone.x, drone.y, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        if (drone.chargeTimer <= 0) {
            drone.isCharging = false;
            drone.energy = DRONES_ENERGY; // Recarregar para 300 quadros (1 minuto)

            // Limpar o segmento atual e recalculá-lo
            drone.segments = null;
            drone.segmentIndex = undefined;
        }
    }
}
