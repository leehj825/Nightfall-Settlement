  // ---------- 출입구 경유지 길찾기 (사각형 성벽) ----------
  // 성벽을 사이에 두고 있으면 목표로 직진하지 않고, 가장 가까운 출입구를 임시 목표로 삼아 문 앞 → 문 뒤 순서로 통과한다.
  // 안/밖 판별은 중앙으로부터의 체비셰프 거리(cheb)와 각 성벽의 half 값을 비교한다.
  // 반환: 통과해야 하는 성벽의 half (없으면 null)
  function ringToCross(px, pz, tx, tz) {
    const rings = [...new Set(gateWaypoints.map(g => g.r))].sort((a, b) => a - b);
    if (!rings.length) return null;
    const dMe = cheb(px, pz), dT = cheb(tx, tz);
    const inward = dMe > dT;                                  // 안쪽으로 가면 바깥 성벽부터, 바깥쪽으로 가면 안쪽 성벽부터
    for (const R of (inward ? rings.slice().reverse() : rings)) {
      const meOut = dMe > R;
      const tgtOut = Math.abs(dT - R) < CFG.GATE_BAND ? meOut : dT > R;   // 성벽 위(청사진/목책)에 있는 목표는 같은 쪽으로 취급
      if (meOut !== tgtOut) return R;
    }
    return null;
  }
  function nearestGate(R) {
    let best = null, bd = Infinity;
    for (const g of gateWaypoints) {
      if (g.r !== R) continue;
      const dx = g.x - npc.position.x, dz = g.z - npc.position.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
  // 선분(P→Q)이 중앙 정사각형(half H)의 내부를 지나는지 (slab 검사)
  function segHitsBox(x0, z0, x1, z1, H) {
    let t0 = 0, t1 = 1;
    for (const [p, d] of [[x0, x1 - x0], [z0, z1 - z0]]) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(p) > H) return false; continue; }
      let a = (-H - p) / d, b = (H - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  }
  // 성벽 바깥에서 목표로 직진하면 성벽 안을 가로지르게 되므로, 성벽 바깥 궤도(모서리 지점)를 거쳐 돌아간다
  function aimPoint(px, pz, tx, tz) {
    const cP = cheb(px, pz), cQ = cheb(tx, tz);
    let R = 0;
    for (const g of gateWaypoints) if (cP > g.r + 1.5 && cQ > g.r - 0.5 && g.r > R) R = g.r;      // 둘 다 이 성벽 바깥쪽인 가장 큰 사각형
    if (!R) { npc.orbitTarget = -1; return [tx, tz]; }
    const H = cQ > R + 1.5 ? R + 1.2 : R - 1.0;                                                     // 성벽 위 목표는 내부만 피한다
    if (!segHitsBox(px, pz, tx, tz, H)) { npc.orbitDir = 0; npc.orbitTarget = -1; return [tx, tz]; }
    // 성벽 바깥 모서리 궤도를 따라 돈다: 향할 모서리(orbitTarget)를 정해 두고, 도착하면 회전 방향(orbitDir)의 인접 모서리로 이어서 이동
    const c = R + 2.5, corners = [[-c, -c], [c, -c], [c, c], [-c, c]];
    if (npc.orbitTarget >= 0 && npc.orbitTarget != null) {
      const [cx, cz] = corners[npc.orbitTarget];
      if (Math.hypot(cx - px, cz - pz) < 2.0) {
        if (!npc.orbitDir) {
          const f = corners[(npc.orbitTarget + 1) % 4], b = corners[(npc.orbitTarget + 3) % 4];
          npc.orbitDir = Math.hypot(tx - f[0], tz - f[1]) <= Math.hypot(tx - b[0], tz - b[1]) ? 1 : -1;
        }
        npc.orbitTarget = (npc.orbitTarget + npc.orbitDir + 4) % 4;
      }
      return corners[npc.orbitTarget];
    }
    npc.orbitDir = 0;
    let best = null, bd = Infinity;
    corners.forEach(([cx, cz], i) => {
      if (segHitsBox(px, pz, cx, cz, H)) return;                       // 성벽 안을 가로질러야 닿는 모서리는 제외 (인접 모서리만)
      const d = Math.hypot(cx - px, cz - pz) + Math.hypot(tx - cx, tz - cz);
      if (d < bd) { bd = d; best = [cx, cz]; npc.orbitTarget = i; }
    });
    return best || [tx, tz];
  }
  // 반환값은 최종 목적지까지의 (이동 전) 거리 - 호출부의 도착 판정에 그대로 쓰인다
  function npcMove(tx, tz, speed, dt) {
    // 끼임 감지: 5초 동안 거의 못 움직이면 stuckFlag를 세우고 살짝 밀어 준다 (호출한 쪽이 작업을 포기하도록)
    const nowMs = performance.now();
    if (!npc.sw || nowMs - npc.sw.last > 800) npc.sw = { x: npc.position.x, z: npc.position.z, t: 0, last: nowMs };
    npc.sw.t += dt; npc.sw.last = nowMs;
    if (npc.sw.t >= 6) {
      const mvd = Math.hypot(npc.position.x - npc.sw.x, npc.position.z - npc.sw.z);
      npc.sw = { x: npc.position.x, z: npc.position.z, t: 0, last: nowMs };
      if (!window.__nfNoFix && mvd < 2.5 && Math.hypot(tx - npc.position.x, tz - npc.position.z) > 2) { npc.stuckFlag = true; npc.position.x += rand(-1.6, 1.6); npc.position.z += rand(-1.6, 1.6); }
    }
    speed *= moveMul(npc);                                    // 굶주림·성격·기분이 이동 속도를 정한다
    // 끼임 방지: 거의 못 움직이면 잠깐 옆으로 비켜 걷는다
    const moved = Math.hypot(npc.position.x - (npc.prevX ?? npc.position.x), npc.position.z - (npc.prevZ ?? npc.position.z));
    npc.prevX = npc.position.x; npc.prevZ = npc.position.z;
    if (npc.nudgeT > 0) npc.nudgeT -= dt;
    else if (moved < speed * dt * 0.2 && Math.hypot(tx - npc.position.x, tz - npc.position.z) > 1.5) {
      npc.stuckT = (npc.stuckT || 0) + dt;
      if (npc.stuckT > 0.5) { npc.stuckT = 0; npc.nudgeT = 0.7; npc.nudgeDir = Math.random() < 0.5 ? 1 : -1; }
    } else npc.stuckT = 0;
    const dFinal = Math.hypot(tx - npc.position.x, tz - npc.position.z);
    const stepTo = (x, z) => { const [ax, az] = aimPoint(npc.position.x, npc.position.z, x, z); npcStep(ax, az, speed, dt); };

    // 이미 출입구 경유 중이면 계속 진행: [문 앞(approach), 문 뒤(exit)]
    if (npc.route) {
      if (npc.route.length === 2 && ringToCross(npc.position.x, npc.position.z, tx, tz) !== npc.routeRing) npc.route = null;   // 목적지가 바뀌어 더는 통과가 필요 없음
      else {
        const pt = npc.route[0];
        if (Math.hypot(pt.x - npc.position.x, pt.z - npc.position.z) < 1.3) {
          npc.route.shift();
          if (!npc.route.length) {                       // 경유 완료 → 해제하고 원래 목적지로 직진
            npc.graceRing = npc.routeRing; npc.graceT = CFG.GATE_GRACE; npc.route = null; npc.wp = null;
          }
        }
        if (npc.route) { stepTo(npc.route[0].x, npc.route[0].z); return dFinal; }
      }
    }
    const R = ringToCross(npc.position.x, npc.position.z, tx, tz);
    if (R !== null && !(npc.graceT > 0 && npc.graceRing === R)) {
      const g = npc.wp && npc.wp.r === R ? npc.wp : (npc.wp = nearestGate(R));        // 경유할 출입구는 한 번 정하면 유지
      if (g) {
        const pOut = cheb(npc.position.x, npc.position.z) > R, k = pOut ? 1 : -1;
        const A = { x: g.x + g.nx * 3 * k, z: g.z + g.nz * 3 * k }, B = { x: g.x - g.nx * 3 * k, z: g.z - g.nz * 3 * k };
        // 출입구 반경 2.0 이내면 문 앞 지점은 건너뛴다
        npc.route = Math.hypot(g.x - npc.position.x, g.z - npc.position.z) < CFG.GATE_REACH ? [B] : [A, B];
        npc.routeRing = R;
        stepTo(npc.route[0].x, npc.route[0].z);
        return dFinal;
      }
    } else npc.wp = null;
    stepTo(tx, tz);
    return dFinal;
  }
  // 목표 지점으로 한 걸음 이동 (장애물 밀어내기 포함, NPC끼리는 충돌하지 않으므로 출입구에서 서로 밀치지 않는다)
  function npcStep(tx, tz, speed, dt) {
    const dx = tx - npc.position.x, dz = tz - npc.position.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      let mx = dx / d, mz = dz / d;
      if (npc.nudgeT > 0) { const t0 = mx; mx = -mz * npc.nudgeDir; mz = t0 * npc.nudgeDir; }   // 끼임 탈출: 목표의 수직 방향
      // 장애물을 정면으로 들이받지 않도록, 가까운 장애물 쪽 성분을 제거하고 옆으로 미끄러진다 (벽에 비비적거림 방지)
      for (const o of obstacles) {
        const ox = npc.position.x - o.position.x, oz = npc.position.z - o.position.z;
        const reach = o.userData.radius + PLAYER_R + 0.45, od = Math.hypot(ox, oz);
        if (od >= reach || od < 1e-4) continue;
        if (Math.abs(o.position.x - tx) < 0.3 && Math.abs(o.position.z - tz) < 0.3) continue;   // 목적지 자체(채집/수리 대상)는 피하지 않는다
        const nx = ox / od, nz = oz / od, into = mx * nx + mz * nz;
        if (into >= 0) continue;
        mx -= into * nx; mz -= into * nz;
        if (Math.hypot(mx, mz) < 0.3) {                       // 정면 충돌이면 목표 쪽으로 가까운 옆 방향 선택
          const side = (nx * mz - nz * mx) >= 0 ? 1 : -1;
          mx = -nz * side; mz = nx * side;
        }
      }
      const ml = Math.hypot(mx, mz) || 1;
      const step = Math.min(d, speed * dt);
      npc.position.x += mx / ml * step; npc.position.z += mz / ml * step;
      npc.face = Math.atan2(mx, mz);
      npc.rotation.y = npc.face;
    }
    for (const o of obstacles) {
      const ox = npc.position.x - o.position.x, oz = npc.position.z - o.position.z;
      const min = o.userData.radius + PLAYER_R, od = Math.hypot(ox, oz);
      if (od < min && od > 1e-4) { npc.position.x = o.position.x + ox / od * min; npc.position.z = o.position.z + oz / od * min; }
    }
    return d;
  }
  // 주간 작업 선택 (제곱거리 비교로 가장 가까운 대상을 O(n) 한 번에 탐색, 다른 동료가 점유한 대상은 제외)
  function nearestOf(list, pred) {
    let best = null, bd = Infinity;
    const nx = npc.position.x, nz = npc.position.z;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!pred(o)) continue;
      const dx = o.position.x - nx, dz = o.position.z - nz, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  const unclaimed = (o) => !(o.userData.skipUntil > gameMin) && (!o.userData.owner || o.userData.owner === npc || !npcs.includes(o.userData.owner));      // 도달할 수 없어 포기한 대상은 한동안 제외
  const reserved = { wood: 0, stone: 0 };       // 건설 담당이 이미 '예약'한 자원 (여럿이 같은 자원을 보고 동시에 건설하러 가지 않게)
  const bpCost = (b) => b.userData.cost ?? CFG.BP_COST[b.userData.res];
  function setTask(nt) {                       // 대상 점유(claim)/해제 + 건설 자원 예약
    if (npc.task) {
      npc.task.target.userData.owner = null;
      if (npc.task.kind === 'build') reserved[npc.task.target.userData.res] -= bpCost(npc.task.target);
    }
    npc.task = nt;
    if (nt) {
      nt.target.userData.owner = npc;
      if (nt.kind === 'build') reserved[nt.target.userData.res] += bpCost(nt.target);
    }
  }
  // 낮 작업 배분: 수리 > (채집조/건설조 분업). 자원이 부족하면 채집 담당을 먼저 정해 두고, 나머지는 '살 수 있는' 청사진만 지으러 간다
  let fortifyTold = false;
  function pickDayTask() {
    const damaged = nearestOf(obstacles, o => o.userData.type === 'fence' && o.userData.hp < o.userData.maxHp && unclaimed(o));
    if (damaged) return { kind: 'repair', target: damaged };
    if (age >= CFG.UPGRADE_FENCE_AGE && res.stone - reserved.stone >= CFG.FENCE_UPGRADE_STONE) {      // 돌 시대가 되면 일꾼이 알아서 목책을 돌 성벽으로 바꾼다
      const wf = nearestOf(obstacles, o => o.userData.type === 'fence' && o.userData.level === 'wood' && unclaimed(o));
      if (wf) { if (!fortifyTold) { fortifyTold = true; toast('Your workers will now rebuild the wooden fences in stone'); } return { kind: 'fortify', target: wf }; }
    }
    const workers = npcs.filter(n => !n.down && !n.promote);
    const gatherers = workers.filter(n => n !== npc && n.task && n.task.kind === 'gather').length;
    const need = { wood: -res.wood, stone: -res.stone };                 // 청사진 전체 비용 - 보유량 = 부족분
    for (const b of blueprints) need[b.userData.res] += bpCost(b);
    const deficit = Math.max(0, need.wood) + Math.max(0, need.stone);
    let want = 0;
    const buffer = Math.max(0, res.wood - reserved.wood) + Math.max(0, res.stone - reserved.stone);       // 지금 바로 쓸 수 있는 여유 자원
    if (deficit > 0) want = workers.length <= 1 ? 0 : (deficit > CFG.GATHER_WORKERS_BIG_DEFICIT && buffer < CFG.GATHER_BUFFER ? Math.ceil(workers.length / 2) : 1);
    if (gatherers >= want) {                                              // 채집조가 충분 → 이 NPC는 건설 (예약 후에도 자원이 남는 청사진만)
      const bp = nearestOf(blueprints, b => unclaimed(b) && res[b.userData.res] - reserved[b.userData.res] >= bpCost(b));
      if (bp) return { kind: 'build', target: bp };
    }
    const wantType = need.wood >= need.stone ? (need.wood > 0 ? 'wood' : null) : (need.stone > 0 ? 'stone' : null);   // 가장 부족한 자원부터
    const isRes = (t) => t === 'wood' || t === 'stone';
    const r = (wantType && nearestOf(obstacles, o => o.userData.type === wantType && unclaimed(o))) ||
              nearestOf(obstacles, o => isRes(o.userData.type) && unclaimed(o));
    return r ? { kind: 'gather', target: r } : null;
  }
  function taskValid(tk) {
    if (tk.kind === 'build') return blueprints.includes(tk.target);
    if (!obstacles.includes(tk.target)) return false;
    if (tk.kind === 'fortify') return tk.target.userData.level === 'wood' && age >= CFG.UPGRADE_FENCE_AGE;
    return tk.kind !== 'repair' || tk.target.userData.hp < tk.target.userData.maxHp;
  }
  // 궁수 야간 AI: 모닥불 곁(안전지대)을 지키며 인식 거리 안의 가장 가까운 적에게 일정 간격으로 화살 발사 (돌진하지 않음)
  function soldierStrike(foe) {
    npc.atkCd = 0.8;
    const ang = Math.atan2(foe.position.x - npc.position.x, foe.position.z - npc.position.z), base = gearDef(npc.gear.sword);
    npc.anim.once('attackSword'); sfxAt('swing', npc.position.x, npc.position.z);
    spawnSlash(npc.position.x, npc.position.z, ang, base);
    sectorHit(npc.position.x, npc.position.z, ang, false, { ...base, dmg: base.dmg * soldierMult(npc) });
  }
  function soldierShoot(foe) {
    const ang = Math.atan2(foe.position.x - npc.position.x, foe.position.z - npc.position.z);
    npc.face = ang; npc.rotation.y = ang;
    if (npc.atkCd <= 0) { npc.atkCd = CFG.ARCHER_FIRE_INTERVAL; npc.anim.once('attackBow'); sfxAt('bow', npc.position.x, npc.position.z); fireArrow(npc.position.x, npc.position.z, ang, false, gearDef(npc.gear.bow).dmg * soldierMult(npc)); }
  }
  // 지휘 명령 'Follow': 병사들이 플레이어 곁에 모여 따라다니며, 플레이어 주변의 적을 함께 상대한다 (낮에도 일을 멈추고 따른다)
  function followStep(dt) {
    if (npc.task) { setTask(null); npc.workT = 0; }
    npc.hidden = false; npc.returning = false;
    let foe = null, bd = 16;
    for (const e of enemies) {
      if (e.userData.sinking || e.userData.siege || e.userData.prowl) continue;
      const d = Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    const idx = npcs.filter(x => x.role !== 'citizen').indexOf(npc), a = idx * 2.4 + player.rotation.y, r = 2.6 + (idx % 2) * 0.9;
    if (foe) {
      if (npc.archer) {
        if (Math.hypot(foe.position.x - npc.position.x, foe.position.z - npc.position.z) <= CFG.ARCHER_AGGRO) { soldierShoot(foe); return 'Fighting'; }
      } else {
        const d = npcMove(foe.position.x, foe.position.z, 5.5, dt);
        if (d < 1.7 && npc.atkCd <= 0) soldierStrike(foe);
        return 'Fighting';
      }
    }
    const d = npcMove(player.position.x + Math.sin(a) * r, player.position.z + Math.cos(a) * r, 5.5, dt);
    if (d < 0.8) { npc.face = Math.atan2(player.position.x - npc.position.x, player.position.z - npc.position.z); npc.rotation.y = npc.face; }
    return 'Following';
  }
  // 밤 훈련: 평화로운 밤에 병영·사격장에서 쉬는 병사는 훈련을 해서 숙련도(베테랑)를 쌓는다 (등급마다 공격력 +6%)
  function trainTick(dt) {
    if (!(builtBuildings('barracks').length || builtBuildings('range').length)) return false;
    npc.trainT = (npc.trainT || 0) + dt;
    if ((npc.trainA = (npc.trainA || 0) + dt) > 3.2) { npc.trainA = 0; npc.anim.once(npc.role === 'archer' ? 'attackBow' : 'attackSword'); }
    if (npc.trainT >= 6) { npc.trainT = 0; const b = vetLv(npc); npc.vxp = (npc.vxp || 0) + 1; if (vetLv(npc) > b) floatText(`${npc.name}: Veteran ${vetLv(npc)}`, npc.position.x, 3.0, npc.position.z); }
    return true;
  }
  function archerDefend(dt) {
    const rs = peaceful ? restSpot(npc, 'night') : null, hx = rs ? rs.x : npc.home.x, hz = rs ? rs.z : npc.home.z;
    if (Math.hypot(npc.position.x - hx, npc.position.z - hz) > 1.0) npcMove(hx, hz, 4.5, dt);
    let foe = null, bd = CFG.ARCHER_AGGRO * (fogNight ? 0.65 : 1);
    for (const e of enemies) {
      if (e.userData.sinking || e.userData.siege || e.userData.prowl) continue;      // 공성 투척병은 궁수가 노릴 수 없다
      const d = Math.hypot(e.position.x - npc.position.x, e.position.z - npc.position.z);
      if (d < bd) { bd = d; foe = e; }
    }
    if (!foe) {
      if (peaceful && Math.hypot(npc.position.x - hx, npc.position.z - hz) < 1.0) { if (rs) faceTo(rs.fx, rs.fz); else faceFire(); return trainTick(dt) ? 'Training' : 'Resting'; }
      return 'Idle';
    }
    soldierShoot(foe);
    return 'Fighting';
  }
  // ---------- 9-2: 병사의 낮 순찰: 할 일이 없을 때 성벽 안쪽을 돌며 걷고, 해 질 녘(17시~)에는 문 앞 초소로 먼저 모인다 ----------
  function guardIdle(dt, hour) {
    if (hour >= 17) {
      const post = sentryPost(npc) || npc.home;
      if (npcMove(post.x, post.z, 3.5, dt) < 0.8) { faceTo(post.x * 2, post.z * 2); return 'On watch'; }
      return 'Taking posts';
    }
    const H = designTier > 0 ? CFG.DESIGN[designTier - 1].half - 3 : 7, i = npc.patrolI = npc.patrolI ?? (npcs.indexOf(npc) * 3) % 8;
    const P = [[1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]][i % 8], tx = P[0] * H, tz = P[1] * H;
    if (npc.patrolWait > 0) { npc.patrolWait -= dt; faceTo(tx * 2, tz * 2); return 'Patrolling'; }
    if (npcMove(tx, tz, 3.2, dt) < 1.3) { npc.patrolI = (i + 1) % 8; npc.patrolWait = 2 + Math.random() * 2; }
    return 'Patrolling';
  }
  function updateNpc(dt, hour, t) {
    if (dead) return;
    if (npc.escort) { escortStep(dt); return; }                       // 원정에 동행 중인 병사
    const isDay = hour >= 6 && hour < 18;
    if (npc.down) {
      if (isDay) reviveNpc(); else { setLabel('Down'); return; }
    }
    npc.atkCd -= dt;
    npc.graceT -= dt;
    let state = 'Idle';
    let bob = 0;
    if (isDay && npc.hidden) { npc.hidden = false; }                       // 아침: 웅크림 해제
    let busy = isDay && npc.promote ? (state = 'Training', promoteStep(dt)) : false;
    if (order === 'follow' && !exActive && npc.role !== 'citizen') { state = followStep(dt); busy = true; }       // 지휘 명령: 플레이어를 따른다
    if (!busy && isDay && gearFetchStep(dt)) { busy = true; state = 'Fetching gear'; }       // 병사: 대장간에서 새 장비 수령
    if (!busy && isDay && npc.role === 'citizen') { const rs = routineStep(dt, hour); if (rs) { busy = true; state = rs; } }
    if (!busy && isDay && npc.role === 'citizen' && workStep(dt)) { busy = true; state = npc.stateLabel; bob = npc.bobAmt; }      // 경제 건물에 정착한 시민

    if (busy) { /* 전직 훈련 이동 중 */ } else if (isDay) {
      // 주간 우선순위: 1) 수리  2) 건설(청사진)  3) 채집
      let task = npc.task;
      if (task && !taskValid(task)) { setTask(null); task = null; npc.workT = 0; }
      if (task) {                                                        // 워치독: 한 작업에 게임 시간 5시간(실제 약 30초) 넘게 매달리면 포기하고 그 대상은 잠시 제외
        task.startMin = task.startMin ?? gameMin;
        if (gameMin - task.startMin > 300) { task.target.userData.skipUntil = gameMin + 180; setTask(null); npc.workT = 0; task = null; }
      }
      npc.pickCd -= dt;
      if (!task && npc.pickCd <= 0) {          // 작업이 끝나거나 사라졌을 때만 새 작업 선택 (중간에 바꾸지 않아 갈팡질팡 방지)
        npc.pickCd = 0.3;
        const nt = pickDayTask();
        if (nt) { setTask(nt); task = nt; npc.workT = 0; }
      }
      if (task) {
        const o = task.target;
        state = { repair: 'Repairing', build: 'Building', gather: 'Gathering', fortify: 'Fortifying' }[task.kind];
        const stop = task.kind === 'build' ? (o.userData.stand ?? 1.2) : o.userData.radius + PLAYER_R + (task.kind === 'repair' || task.kind === 'fortify' ? 0.4 : 0.3);
        const d = Math.hypot(o.position.x - npc.position.x, o.position.z - npc.position.z);
        if (d > stop) { npcMove(o.position.x, o.position.z, 3.5, dt); npc.workT = 0; }
        else {
          npc.face = Math.atan2(o.position.x - npc.position.x, o.position.z - npc.position.z);
          npc.rotation.y = npc.face;
          if (task.kind === 'build' && npc.workT === 0 && res[o.userData.res] < (o.userData.cost ?? CFG.BP_COST[o.userData.res])) {
            // 도착했는데 나무가 부족하면 건설 보류, 즉시 채집으로 전환
            setTask(null);                       // (플레이어가 자원을 써 버린 경우) 건설 보류 → 다음 선택에서 채집으로 배정
          } else {
            npc.workT += dt * workMul(npc);       // 굶주림·성격·기분이 작업 효율을 정한다
            bob = 0;
            if (task.kind === 'build' && npc.workT >= (o.userData.buildTime ?? CFG.BUILD_TIME)) {
              const kind = o.userData.res, cost = o.userData.cost ?? CFG.BP_COST[kind];
              if (res[kind] >= cost) {
                res[kind] -= cost; updateHud();
                blueprints.splice(blueprints.indexOf(o), 1); scene.remove(o);
                if (o.userData.bkind) createBuilding(o.userData.bkind, o.position.x, o.position.z);
                else createStructure(kind, o.position.x, o.position.z, o.rotation.y);
                dust(o.position.x, o.position.z); sfxAt('build', o.position.x, o.position.z); report.built++;
              }
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'repair' && npc.workT >= CFG.REPAIR_TIME) {
              o.userData.hp = o.userData.maxHp;
              dust(o.position.x, o.position.z);
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'fortify' && npc.workT >= CFG.REPAIR_TIME * 1.5) {
              if (res.stone >= CFG.FENCE_UPGRADE_STONE) { res.stone -= CFG.FENCE_UPGRADE_STONE; makeStoneFence(o); updateHud(); dust(o.position.x, o.position.z); sfxAt('build', o.position.x, o.position.z); report.built++; }
              else o.userData.skipUntil = gameMin + 120;
              setTask(null); npc.workT = 0;
            } else if (task.kind === 'gather' && npc.workT >= CFG.GATHER_TIME) {
              const type = o.userData.type;
              scene.remove(o); obstacles.splice(obstacles.indexOf(o), 1);
              res[type] += gatherYield(type); rollIron(o); updateHud(); sfxAt('chop', o.position.x, o.position.z);
              setTask(null); npc.workT = 0;
            }
          }
        }
      } else if (npc.role !== 'citizen' && order !== 'follow') state = guardIdle(dt, hour);
      else npcMove(npc.home.x, npc.home.z, 3.5, dt);
    } else {
      // 야간: 모닥불 방어
      npc.target = null; npc.gatherT = 0; setTask(null); npc.workT = 0;
      if (npc.role === 'citizen') {
        if (peaceful && npc.work && obstacles.includes(npc.work) && npc.work.userData.kind === 'smith') {            // 대장장이는 평화로운 밤에도 불빛 아래서 일한다 (1.5배)
          if (workStep(dt)) { state = npc.stateLabel; bob = npc.bobAmt; } else state = citizenRest(dt);
        } else state = peaceful ? citizenRest(dt) : citizenHide(dt);
      } else if (npc.archer) state = archerDefend(dt); else {
      let foe = null, bd = CFG.MELEE_AGGRO;      // 성벽 밖까지 인식 → npcMove의 출입구 경유 길찾기로 밖에 나가 싸우고, 끝나면 문으로 복귀
      for (const e of enemies) {
        if (e.userData.sinking || e.userData.siege || e.userData.prowl) continue;
        const d = Math.hypot(e.position.x - npc.position.x, e.position.z - npc.position.z);
        if (d < bd) { bd = d; foe = e; }
      }
      if (npc.returning || !foe) {
        const post = sentryPost(npc), rs = peaceful && !post ? restSpot(npc, 'night') : null, tgt = post || rs || npc.home;
        if (npcMove(tgt.x, tgt.z, 5, dt) < 0.8) { npc.returning = false; if (post) { state = 'Guarding'; npc.face = Math.atan2(-post.x, -post.z) + Math.PI; npc.rotation.y = npc.face; } else if (peaceful) { state = trainTick(dt) ? 'Training' : 'Resting'; if (rs) faceTo(rs.fx, rs.fz); else faceFire(); } }      // 성문 경비는 문 앞에 서고, 나머지는 평화로운 밤에 모닥불 곁에 앉아 쉰다
      } else {
        state = 'Fighting';
        const d = npcMove(foe.position.x, foe.position.z, 5.5, dt);
        if (d < 1.7 && npc.atkCd <= 0) {
          soldierStrike(foe);
          if (!enemies.includes(foe)) npc.returning = true;     // 처치했으면 모닥불로 복귀
        }
      }
      }
    }
    // 애니메이션 상태 머신: 실제 이동 속도 + 현재 행동으로 Idle / Walk / Run / Gather / Sit 을 고른다 (전환은 CrossFade)
    const mv = Math.hypot(npc.position.x - npc.px, npc.position.z - npc.pz) / Math.max(dt, 1e-4);
    npc.px = npc.position.x; npc.pz = npc.position.z;
    const working = state === 'Gathering' || state === 'Building' || state === 'Repairing' || state === 'Chopping' || state === 'Quarrying' || state === 'Farming';
    let anim = mv > 4.4 ? 'run' : mv > 0.5 ? 'walk' : 'idle';
    if ((state === 'Resting' || state === 'Lunch break') && mv < 0.5) anim = 'sit'; else if ((working || state === 'Drawing water') && mv < 0.8) anim = 'gather';
    npc.anim.base(anim, mv);
    const bs = npc.rig.baseScale;
    npc.body.scale.set(bs, bs * (npc.hidden ? 0.55 : 1), bs);                // 숨은 시민은 웅크린다
    if (npc.stuckFlag) {                                                   // 끼인 NPC: 지금 목표를 한동안 포기하고 다른 일을 고른다
      npc.stuckFlag = false;
      if (npc.task) { npc.task.target.userData.skipUntil = gameMin + 180; setTask(null); npc.workT = 0; }
      if (npc.wtarget) { npc.wtarget.userData.skipUntil = gameMin + 180; npc.wtarget = null; }
      if (npc.promote) npc.promote = npc.promote;
      if (npc.patrolI != null) npc.patrolI = (npc.patrolI + 1) % 8;
    }
    npc.stateNow = state;
    setLabel(state);
  }

