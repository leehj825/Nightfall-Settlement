// Nightfall Settlement - balance and content data (CFG). Tweak numbers here.
  // ---------- 밸런스 설정 (여기서 조절) ----------
  const CFG = {
    TREE_COUNT: 60, STONE_COUNT: 50,           // 맵에 항상 유지하려는 나무 / 바위 수 (모자라면 계속 다시 채워진다)
    REPLENISH_INTERVAL: 2.5, REPLENISH_BATCH: 3,   // 자원 보충 주기(초) / 한 번에 종류별 최대 보충 수
    SPAWN_ZONES: { inner: 0.4, annulus: 0.35 },    // 자원 생성 위치 비율: 마을 안쪽 / 1~2단계 성벽 사이 (나머지는 맵 전체) → 동료가 문을 덜 드나든다
    GATHER_WORKERS_BIG_DEFICIT: 30, GATHER_BUFFER: 15,   // 부족분이 크고 여유 자원이 GATHER_BUFFER 미만일 때만 채집조를 절반으로 늘린다 (평소엔 1명)
    GATHER_YIELD: { wood: 3, stone: 3 },       // 1회 채집당 획득량 (플레이어·동료 공통)
    BP_COST: { wood: 5, stone: 5 },            // 동료가 청사진 1개를 지을 때 드는 자원 (나무 목책 / 돌 성벽)
    // 자동 방어선 도면: 모닥불(0,0) 기준 원형 배치. gaps = 비워 둘 슬롯 번호(출입구)
    DESIGN: [      // 사각형 방어선: half = 한 변의 절반(중앙 기준), perHalf = 중심에서 모서리까지 구간 수 (부재 간격 = half / perHalf)
      { label: 'Defense Line: Tier 1', cost: { wood: 30 }, half: 15, perHalf: 5, kind: 'wood' },     // 30 x 30
      { label: 'Defense Line: Tier 2 (Stone)', cost: { stone: 50 }, half: 25, perHalf: 7, kind: 'stone', age: 3 },   // 50 x 50
    ],
    // ----- 시대 발전 (테크 트리): 모닥불/마을 회관을 클릭해서 업그레이드 -----
    AGES: [
      { name: 'Camp', hall: 'Campfire', unlock: 'Wooden fences · Tents' },
      { name: 'Wooden Town', hall: 'Wooden Town Hall', cost: { wood: 50 }, unlock: 'Barracks · Archery Range · Farm · Lumber Camp · Quarry' },
      { name: 'Stone Fortress', hall: 'Stone Keep', cost: { wood: 100, stone: 100 }, unlock: 'Stone walls · Defense towers' },
    ],
    FIRE_HP_BY_AGE: [150, 260, 420], HALL_RADIUS: [0.8, 2.6, 3.4],      // 시대별 거점 체력 / 충돌 반지름
    UPGRADE_FENCE_AGE: 3,                                              // 목책 → 돌 성벽 강화는 3시대부터
    // 마을 인프라 설계: 시대가 열릴 때마다 다음 묶음을 설계할 수 있다. lots는 사각 방어선 안쪽 격자 배치 (auto: 벌목장/채석장은 숲/바위 근처에 자동 선정)
    TOWN_GROUPS: [
      { age: 1, label: 'Plan Tent Village', cost: { wood: 40 }, lots: [{ kind: 'house', x: -9, z: -9 }, { kind: 'house', x: -4, z: -9 }, { kind: 'house', x: 4, z: -9 }] },
      { age: 2, label: 'Plan Age 2 Buildings', cost: { wood: 70 }, lots: [
        { kind: 'smith', x: -11.5, z: -4.4 }, { kind: 'barracks', x: -7.5, z: 9 }, { kind: 'range', x: 6.5, z: 9 }, { kind: 'farm', x: 10.5, z: -8 }, { kind: 'farm', x: 11, z: 5 },
        { kind: 'well', auto: 'town' }, { kind: 'lumber', auto: true }, { kind: 'quarry', auto: true }] },
      { age: 3, label: 'Plan Towers & Market', cost: { wood: 40, stone: 60 }, lots: [
        { kind: 'market', auto: 'town' },
        { kind: 'tower', x: -12.3, z: -12.3 }, { kind: 'tower', x: 12.3, z: -12.3 }, { kind: 'tower', x: -12.3, z: 12.3 }, { kind: 'tower', x: 12.3, z: 12.3 }] },
    ],
    BUILDING: {
      house: { res: 'wood', cost: 6, radius: 2.1 }, barracks: { res: 'stone', cost: 6, radius: 3.6 }, range: { res: 'wood', cost: 8, radius: 2.6 },
      farm: { res: 'wood', cost: 6, radius: 0.3, size: [5, 0.4, 4] }, lumber: { res: 'wood', cost: 8, radius: 1.8, size: [3.4, 2, 3] },
      smith: { res: 'wood', cost: 10, radius: 2.4, size: [4.2, 2.6, 3.4] },
      well: { res: 'wood', cost: 6, radius: 1.3, size: [2.4, 2.4, 2.4] }, market: { res: 'wood', cost: 12, radius: 2.6, size: [5.2, 2.4, 3.4] },
      quarry: { res: 'wood', cost: 8, radius: 1.8, size: [3.4, 2, 3] }, tower: { res: 'stone', cost: 10, radius: 1.7, size: [3.2, 4.5, 3.2] },
    },
    // 경제 건물: 시민이 정착해서 일한다. 농장은 식량 생산, 벌목장/채석장은 주변 자원을 캐서 건물로 가져와 쌓는다(효율 배수)
    FARM_CYCLE: 8, FARM_YIELD: 2, WORK_RADIUS: 14, WORKSITE_YIELD_MULT: 2, SITE_REGROW: 7,   // SITE_REGROW: 건물 주변에 자원이 다시 자라는 주기(초)
    SEASONS_ON: true, SICK_ON: true, SEASON_DAYS: 3, SICK_DAYS: 2,                                   // 계절(3일마다 바뀜) / 질병 규칙은 끌 수 있다
    // 9단계: 직업(일터)과 숙련도 / 건물 레벨
    LEVELED: ['farm', 'lumber', 'quarry', 'smith', 'market', 'well'], BUILD_UPGRADE: { 2: { wood: 20, stone: 10 }, 3: { stone: 30, iron: 6 } }, BUILD_UPGRADES_PER_MORNING: 1,
    JOBS: { farm: 'Farmer', lumber: 'Woodcutter', quarry: 'Stonecutter', smith: 'Blacksmith' },
    TRAIT_JOB: { stout: 'quarry', nimble: 'lumber', cheerful: 'farm', easygoing: 'farm', diligent: 'smith', brave: 'smith' },          // 성격에 맞는 일터: 효율 +10%, 기분 +4
    SKILL_XP: [0, 4, 10, 20], SKILL_NAMES: ['Novice', 'Skilled', 'Expert', 'Master'], SKILL_BONUS: 0.12,                          // 일 한 번 끝낼 때마다 경험치 +1, 숙련 단계마다 작업 속도 +12%
    HOUSE_UPGRADE: { 2: { wood: 15 }, 3: { stone: 20 } }, HOUSE_UPGRADES_PER_MORNING: 2,        // 집은 시대가 올라도 한 번에 바뀌지 않고, 매일 아침 여유 자원으로 한두 채씩 업그레이드된다
    PROSPERITY_LABELS: [[30, 'Fragile'], [55, 'Settled'], [80, 'Thriving'], [101, 'Flourishing']], PROSPERITY_POP_TARGET: 6,
    NAMES: ['Aldric', 'Bram', 'Cora', 'Dara', 'Edda', 'Finn', 'Gwen', 'Hale', 'Iris', 'Joss', 'Kira', 'Lars', 'Mira', 'Nell', 'Orin', 'Pia', 'Quinn', 'Rolf', 'Sela', 'Tomas', 'Una', 'Vik', 'Wren', 'Yara', 'Zane', 'Ada', 'Boris', 'Cato', 'Dina', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kell', 'Lena', 'Milo', 'Nora', 'Otto'],
    // 특성: work(작업 속도 배율), move(이동 속도), hp(체력), dmg(받는 피해), mood(기본 기분 보정), ration(배급량 배율), aura(주변 모두의 기분)
    TRAITS: {
      diligent: { label: 'Diligent', desc: 'Works 25% faster', work: 1.25 }, easygoing: { label: 'Easygoing', desc: 'Works 20% slower, but is rarely upset', work: 0.8, mood: 8 },
      nimble: { label: 'Nimble', desc: 'Moves 15% faster', move: 1.15 }, stout: { label: 'Stout', desc: 'Has 30% more health', hp: 1.3 },
      brave: { label: 'Brave', desc: 'Takes 15% less damage', dmg: 0.85 }, timid: { label: 'Timid', desc: 'Flees 30% faster, easily upset', mood: -8 },
      glutton: { label: 'Hearty eater', desc: 'Eats double rations', ration: 2 }, cheerful: { label: 'Cheerful', desc: 'Lifts everyone\'s mood a little', mood: 10, aura: 2 },
      gloomy: { label: 'Gloomy', desc: 'Hard to please', mood: -10 },
    },
    MOOD_LEAVE: 15, MOOD_UNHAPPY: 35, MOOD_HAPPY: 75,                  // 기분이 이 아래면 마을을 떠날 수 있다 / 불만 / 행복
    // 플레이어 역할: 전투형(전위에서 싸운다) / 지휘형(병사를 이끈다)
    CLASSES: {
      warrior: { label: 'Warrior', desc: '130 HP, +25% weapon damage, faster Dash and Ultimate. Fights on the front line.' },
      commander: { label: 'Commander', desc: '80 HP, -20% damage. Rally Cry (E) heals and empowers soldiers, Orders (R) calls them to your side, and soldiers near you hit 15% harder.' },
    },
    RALLY_CD: 20, RALLY_TIME: 8, RALLY_RADIUS: 20,
    // 시대별 특성(퍼크): 각 시대에 하나씩 고른다
    PERKS: {
      1: [{ id: 'forager', label: 'Forager', desc: '+1 wood and stone from every gather' }, { id: 'fortifier', label: 'Fortifier', desc: 'Wooden fences have 50% more health' }, { id: 'scout', label: 'Scout', desc: '+10% move speed and faster healing by the fire' }],
      2: [{ id: 'lord', label: 'Lord', desc: 'Soldiers have +15% health and +10% damage' }, { id: 'merchant', label: 'Merchant', desc: 'Market trades pay more, worksites haul 25% more' }, { id: 'smith', label: 'Master Smith', desc: 'Forging is faster and gear costs 25% less' }],
      3: [{ id: 'warlord', label: 'Warlord', desc: 'Ultimate, Rally and Dash recharge much faster' }, { id: 'steward', label: 'Steward', desc: '+10 prosperity, happier citizens, +1 max population' }, { id: 'engineer', label: 'Engineer', desc: 'Towers hit 50% harder and reach further, stone walls +50% health' }],
    },
    // 원정: 낮에 마을 밖의 별도 지역으로 떠났다가 해 지기 전에 돌아온다 (EXP_LATEST 이후에는 출발 불가, EXP_FORCE에는 자동 귀환)
    EXP_LATEST: 13, EXP_FORCE: 17.5, EXP_TIME_MULT: 0.5,         // 원정 중에는 게임 시계가 절반 속도 (현실 1초 = 게임 2.2분): 8시 출발이면 현실 약 4분 20초
   
    EXPEDITIONS: [
      { id: 'quarry', name: 'Old Quarry', age: 1, tint: 0x8a7a5a, risk: 'Low', reward: 'Stone, iron', desc: 'Abandoned cuts of good stone. Quiet, with a few beasts.', trees: 4, rocks: 6, ore: 8, chests: 1, foes: ['beast', 'beast', 'normal'] },
      { id: 'forest', name: 'Deep Forest', age: 1, tint: 0x3f6a3a, risk: 'Low', reward: 'Wood, food', desc: 'Ancient trees and hidden caches. Wolves and bandits roam between them.', trees: 22, rocks: 3, ore: 0, chests: 3, foes: ['beast', 'beast', 'normal', 'normal'] },
      { id: 'tower', name: 'Ruined Watchtower', age: 2, tint: 0x6a6a70, risk: 'Medium', reward: 'Iron, Beacon Lens', desc: 'A toppled tower still held by raiders. One of its chests holds a Beacon relic.', trees: 3, rocks: 5, ore: 0, chests: 3, relic: 'Beacon Lens', ruins: 8, foes: ['normal', 'normal', 'shield', 'normal', 'brute'] },
      { id: 'mine', name: 'Iron Mine', age: 2, tint: 0x4a4048, risk: 'Medium', reward: 'Lots of iron, Iron Heart', desc: 'Rich veins of iron deep in the hill. The tunnels are crowded with guards.', trees: 0, rocks: 4, ore: 14, chests: 2, relic: 'Iron Heart', ruins: 4, foes: ['normal', 'shield', 'shield', 'brute', 'normal'] },
      { id: 'citadel', name: 'Fallen Citadel', age: 3, tint: 0x55485a, risk: 'High', reward: 'Rich loot, Beacon Core', desc: 'The old fortress. Its guardians will not give up the last relic without a fight.', trees: 0, rocks: 6, ore: 6, chests: 4, relic: 'Beacon Core', ruins: 12, foes: ['brute', 'brute', 'shield', 'shield', 'normal', 'normal', 'normal'] },
      { id: 'pass', name: 'Frozen Pass', ch: 2, age: 3, tint: 0xb9cde0, risk: 'High', reward: 'Shards, iron, Frost Shard', desc: 'A frozen mountain road. Frostbitten raiders and a hulking guardian hold the way.', trees: 2, rocks: 8, ore: 6, chests: 4, relic: 'Frost Shard', ruins: 6, foes: ['normal', 'normal', 'shield', 'shield', 'brute', 'normal'], guardian: { kind: 'brute', hpMul: 3, scale: 1.4 } },
      { id: 'temple', name: 'Sunken Temple', ch: 2, age: 3, tint: 0x3f6d78, risk: 'High', reward: 'Shards, food, Tide Shard', desc: 'Flooded halls of an older civilization. The guardian here hides behind a great shield.', trees: 0, rocks: 6, ore: 0, chests: 5, relic: 'Tide Shard', ruins: 14, foes: ['normal', 'normal', 'normal', 'shield', 'shield', 'brute', 'beast'], guardian: { kind: 'shield', hpMul: 5, scale: 1.4 } },
      { id: 'forge', name: 'Ember Forge', ch: 2, age: 3, tint: 0x6a3a2a, risk: 'Very high', reward: 'Shards, lots of iron, Ember Shard', desc: 'A forge that never went cold. Its keeper strikes like a falling anvil.', trees: 0, rocks: 4, ore: 12, chests: 4, relic: 'Ember Shard', ruins: 6, foes: ['brute', 'shield', 'shield', 'normal', 'normal', 'normal', 'brute'], guardian: { kind: 'brute', hpMul: 4, scale: 1.5 } },
      { id: 'frostmarch', name: 'Frostmarch', ch: 3, age: 3, tint: 0xdfe9f5, risk: 'Extreme', reward: 'Shards, iron, Winter Crown', desc: 'A frozen wasteland past the Dawn Gate where a pale host marches. Bring soldiers - the Frost Warden will not fall to one blade.', trees: 3, rocks: 6, ore: 6, chests: 5, relic: 'Winter Crown', ruins: 10, faction: 'frost',
        foes: ['normal', 'normal', 'normal', 'normal', 'shield', 'shield', 'shield', 'brute', 'brute', 'brute'], guardian: { kind: 'brute', hpMul: 7, scale: 1.7, name: 'Frost Warden' } },
      { id: 'barrow', name: 'Sunken Barrow', ch: 4, age: 3, tint: 0x3a3550, risk: 'Extreme', reward: 'Shards, iron, Echo Stone', desc: 'A burial mound sunk into violet mist. Pale soldiers stand watch over the keepers who rest here.', trees: 0, rocks: 6, ore: 4, chests: 5, relic: 'Echo Stone', ruins: 14, faction: 'hollow',
        foes: ['normal', 'normal', 'normal', 'normal', 'shield', 'shield', 'shield', 'brute', 'brute', 'beast', 'beast'], guardian: { kind: 'shield', hpMul: 7, scale: 1.55, name: 'Barrow Warden' } },
      { id: 'chapel', name: 'Mourning Chapel', ch: 4, age: 3, tint: 0x4a3a58, risk: 'Extreme', reward: 'Shards, food, Mourning Bell', desc: 'A roofless chapel where a bell tolls without a ringer. Heavy guards circle the altar.', trees: 2, rocks: 5, ore: 0, chests: 5, relic: 'Mourning Bell', ruins: 12, faction: 'hollow',
        foes: ['brute', 'brute', 'brute', 'brute', 'shield', 'shield', 'shield', 'normal', 'normal', 'normal'], guardian: { kind: 'brute', hpMul: 9, scale: 1.65, name: 'Bell Ringer' } },
      { id: 'spire', name: 'Obsidian Spire', ch: 4, age: 3, tint: 0x1d1a2c, risk: 'Deadly', reward: 'Shards, lots of iron, Keeper\'s Oath', desc: 'The Hollow King\'s black tower. Only those who carry the Echo Stone and the Mourning Bell can find the door.', trees: 0, rocks: 8, ore: 8, chests: 6, relic: 'Keeper\'s Oath', ruins: 16, faction: 'hollow', needs: ['barrow', 'chapel'],
        foes: ['brute', 'brute', 'brute', 'shield', 'shield', 'shield', 'shield', 'normal', 'normal', 'normal', 'normal', 'beast'], guardian: { kind: 'brute', hpMul: 13, scale: 2.1, name: 'The Hollow King' } },
    ],
    // 10단계: 원정지를 모두 정리(상자 전부 + 적 전부)하면 야영지를 세울 수 있다. 야영지는 매일 아침 자원을 가져다준다 (겨울에는 60%)
    CAMPS: { quarry: { stone: 6, iron: 1 }, forest: { wood: 8, food: 3 }, tower: { iron: 2, stone: 4 }, mine: { iron: 4 }, citadel: { stone: 6, iron: 3, wood: 6 }, pass: { iron: 3, food: 4 }, temple: { food: 6, wood: 5 }, forge: { iron: 5, stone: 4 }, frostmarch: { iron: 6, food: 6, stone: 6 }, barrow: { iron: 6, stone: 8 }, chapel: { food: 8, wood: 8, iron: 4 }, spire: { iron: 10, stone: 8, food: 6 } },
    CAMP_COST: { 1: { wood: 35, stone: 25 }, 2: { wood: 50, stone: 40 }, 3: { wood: 65, stone: 55, iron: 4 } },
    ESCORT_MAX: 3,
    // 원정이 열리는 전투력: 병사(기본 2 + 무기 등급×2 + 방어구 등급×1.5)의 합 + 주인공(레벨×3 + 무기 등급×3 + 방어구 등급×2). 장비와 레벨을 키워야 다음 원정이 열린다
    EXP_NEED: { quarry: 0, forest: 0, tower: 20, mine: 28, citadel: 45, pass: 60, temple: 64, forge: 68, frostmarch: 85, barrow: 95, chapel: 100, spire: 110 },
    // 이야기 3장 (새벽의 문을 연 뒤): 서리 행군의 수호자를 쓰러뜨린다
    STORY3: [
      { id: 'frostmarch', goal: 'Take the Winter Crown from the Frost Warden in the Frostmarch', title: 'The Winter Crown', text: 'The Warden falls in a ringing of ice. The crown in its hands is cold, but it lights up when it meets the Beacon. Whatever marches in the dark has lost its leader.', reward: { iron: 20, shard: 2 } },
    ],
    STORY_CROWN: { title: 'The Crown Wakes', text: 'With the Winter Crown on the Beacon, the cold pulls back from your borders. But the Crown does not rest: its frost-light bends toward the north, tracing a road you have never seen - and from somewhere along it, a bell begins to toll.' },
    // 4장 (겨울 왕관을 얻은 뒤): 속 빈 궁정 - 비콘을 켠 첫 수호자들의 흔적을 모아 속 빈 왕을 만난다
    STORY_HOLLOW: { title: 'The Hollow Court', text: 'The tolling does not stop. In the Beacon\'s light you finally see the road the Crown has drawn: three places, each marked with the same sign - a lantern with no flame. A traveler at your gate says only this: "The Beacon was never meant to be lit by one hand alone. Before you there were keepers. Find what they left behind." Open the Journal (J): the Sunken Barrow and the Mourning Chapel come first.' },
    STORY4: [
      { id: 'barrow', goal: 'Recover the Echo Stone from the Sunken Barrow', title: 'The Echo Stone', text: 'The stone is warm, and it speaks in many quiet voices - keepers who lit the Beacon before you, villagers like yours, each holding the dark back one more night. The last voice says only: "He was one of us."', reward: { iron: 12, shard: 1 } },
      { id: 'chapel', goal: 'Recover the Mourning Bell from the Mourning Chapel', title: 'The Mourning Bell', text: 'The bell tolls once in your hands and the whole village looks up. It was never a warning - it was a farewell, rung for every keeper who did not come home. The tolling you have heard was the Hollow King, mourning his own court.', reward: { iron: 12, shard: 1 } },
      { id: 'spire', goal: 'Reach the Obsidian Spire and face the Hollow King', title: 'The Keeper\'s Oath', text: 'The Hollow King was the first keeper. When the dark grew too heavy he sealed himself in the Spire and let the cold speak for him. In his hand is an oath, three lines long, signed with every name the Echo Stone remembered. You add yours.', reward: { iron: 25, shard: 3 } },
    ],
    STORY_FINALE: { title: 'The Last Keeper', text: 'With the oath complete, the Beacon burns steady for the first time - not a lock on the dark, but a hearth the whole land can see. The nights will still come, and they will still be hard. But they will no longer find you alone. Your village is the new Court, and you are its Keeper. (The nights go on - keep building, and keep the light.)' },
    // 이야기 2장 (비콘을 켠 뒤): 세 개의 조각을 모아 새벽의 문을 연다
    STORY2: [
      { id: 'pass', goal: 'Recover the Frost Shard from the Frozen Pass', title: 'The Frost Shard', text: 'A shard of blue ice that never melts. It hums in answer to the Beacon, a note colder than any you have heard.', reward: { iron: 10, shard: 1 } },
      { id: 'temple', goal: 'Recover the Tide Shard from the Sunken Temple', title: 'The Tide Shard', text: 'Water curls inside the glass as though the sea were trapped there. The temple guardian guarded it for longer than the village has existed.', reward: { iron: 10, shard: 1 } },
      { id: 'forge', goal: 'Recover the Ember Shard from the Ember Forge', title: 'The Ember Shard', text: 'A coal that glows without burning. The forge keeper will not be forging anything again, and the road home feels lighter.', reward: { iron: 12, shard: 1 } },
    ],
    STORY_DAWN: { title: 'The Dawn Gate', text: 'The three shards fuse into a key of light. Beyond the Beacon a gate opens in the sky, and for one breath the night is gone. Your smiths find the secret in the shards: Beacon gear can now be forged. The dark will come back - but it will meet something new.' },
    // 이야기: 목표는 순서대로 표시되지만 유물은 어느 순서로든 찾을 수 있다. 처음 달성하면 이야기 장면이 나온다
    STORY: [
      { id: 'first', goal: 'Take your first expedition and come back alive', title: 'Beyond the Walls', text: 'You walked past the walls and came home alive - the village noticed. Warden Edda marks the charred map: a toppled watchtower, an iron mine and a fallen citadel. The nearer roads open once the village grows into a Wooden Town.', reward: { wood: 10, stone: 5, iron: 2 } },
      { id: 'tower', goal: 'Recover the Beacon Lens from the Ruined Watchtower (Age 2)', title: 'The Beacon Lens', text: 'A cracked lens of glass, warm to the touch. The first relic hums as if it remembers fire. Edda taps the map: "The old iron mine keeps the next one."', reward: { iron: 5 } },
      { id: 'mine', goal: 'Recover the Iron Heart from the Iron Mine (Age 2)', title: 'The Iron Heart', text: 'A heart of dark iron, heavier than it should be. The second relic. Only one remains, in the citadel far to the north - taken long ago by the people who now guard it.', reward: { iron: 8 } },
      { id: 'citadel', goal: 'Recover the Beacon Core from the Fallen Citadel (Age 3)', title: 'The Beacon Core', text: 'The last relic pulses in your hands, and the other two answer it. Hurry home - something wants to burn bright tonight.', reward: { iron: 10 } },
    ],
    STORY_BEACON: { title: 'The Beacon Is Lit', text: 'Back at the hall the old lantern flares, and a pillar of golden light climbs into the sky. Raiders will think twice, and your people stand a little taller. The village is safe tonight - yet the road beyond the citadel is dark and long...' },
    FORGE_CYCLE: 10,                                                  // 대장간 시민이 장비 1개를 자동 제작하는 주기(초)
    RATION: 2, HUNGER_MULT: 0.5, IRON_CHANCE: 0.5,                    // 매일 아침 시민 1명당 식량 1개 / 굶주린 시민의 이동·작업 배율 / 바위 채집 시 철 획득 확률
    FOOD_MEAL: 5, FOOD_HEAL: 40, FOOD_AUTO_BELOW: 0.5,               // 식량 5개 = 체력 40 회복, 체력이 50% 미만이면 자동 식사
    TOWER_DMG: 2, TOWER_RANGE: 22, TOWER_INTERVAL: 1.3,
    // ----- 습격의 날(Raid Day): RAID_EVERY일마다 붉은 달 대규모 습격, 나머지 밤은 조용한 밤(짐승 / 소수) -----
    RAID_GAPS: [4, 3, 4, 3, 5],            // 큰 습격의 날 간격: 3일차, 7일차(보스), 10, 14, 17, 22 ... (하루 전 아침에 경고가 뜬다)
    QUIET_BASE: 1, QUIET_MAX: 6, BEAST_HP: 1,
    BUILD_TIME_BUILDING: 3,
    BASE_POP: 3, CITIZEN_HP: 30,               // 시작 인구(초기 동료 3명) / 시민 체력. 최대 인구 = BASE_POP + 거주지 수
    // 공성 투척병 (Day 4~): 초장거리에서 곡사로 폭발 바위를 던져 구조물을 광역 파괴. 궁수(30)가 닿지 않는 거리에 멈춘다
    SIEGE_FROM_DAY: 4, SIEGE_HP: 4, SIEGE_STANDOFF: 42, SIEGE_INTERVAL: 4.5,
    ROCK_DAMAGE: 50, ROCK_SPLASH: 4, ROCK_FLIGHT_SPEED: 18, FIRE_HP: 150,   // 바위 구조물 피해 / 폭발 반경 / 비행 속도 / 모닥불 체력
    // 대시: 바라보는 방향으로 DASH_DIST만큼 빠르게 이동, 무적 DASH_INVULN초, 쿨타임 DASH_CD초
    // Day 7 보스 '베헤모스' + 지진 강타(충격파)
    BOSS_DAY: 7, BOSS_HP: 100, BOSS_SCALE: 3, BOSS_SPEED_MUL: 0.5, BOSS_CONTACT_DMG: 40, BOSS_KB_MUL: 0.15,
    BOSS_SLAM_INTERVAL: 5, BOSS_JUMP_TIME: 0.6,
    // 충격파: 구조물 피해는 거리에 따라 줄고(QUAKE_FALLOFF), 동료/시민은 피해 거의 없이 넉백만(상한 QUAKE_NPC_KB), 플레이어는 대시 무적으로 회피
    QUAKE_SPEED: 14, QUAKE_MAX: 22, QUAKE_STRUCT_DMG: 25, QUAKE_FALLOFF: 0.6, QUAKE_NPC_DMG: 1, QUAKE_NPC_KB: 7, QUAKE_PLAYER_DMG: 35, QUAKE_KB: 4, QUAKE_FIRE_DMG: 15,
    // 보스 패턴: 지진 전 캐스팅(궁수 궁극기로 끊으면 기절), 타격 시 어그로 고정, 모닥불은 즉사가 아니라 초당 피해
    BOSS_CAST_TIME: 1.5, BOSS_STUN_TIME: 3, STUN_DMG_MULT: 2, BOSS_LURE_TIME: 10,
    BOSS_FIRE_DPS: 20, BOSS_FIRE_BUMP_TIME: 2.5, BOSS_FIRE_BUMP_DIST: 6,
    BOSS_SPAWN_HOUR: 21.5,                     // 보스 등장 시각(밤 시작 20시 이후, 24 넘으면 +24)
    // 플레이어 회복: 모닥불 곁 자동 회복 + 아침 완전 회복. 모닥불도 낮에 서서히 회복
    PLAYER_MAX_HP: 100, REGEN_RATE: 4, REGEN_RADIUS: 7, REGEN_DELAY: 2, FIRE_REGEN: 8,
    // 플레이어 궁극기 '회전 강타'
    ULT_RADIUS: 8, ULT_DAMAGE: 10, ULT_CD: 15, ULT_KB: 6,
    // 1장 클리어 후 무한 모드: Day 8부터 하루마다 적 수 / 체력 추가 증가
    ENDLESS_EXTRA_PER_DAY: 3, ENDLESS_HP_PER_DAY: 1,
    DASH_DIST: 10, DASH_TIME: 0.2, DASH_INVULN: 0.5, DASH_CD: 2,
    ARROW_RANGE: 30, ARROW_SPEED: 45,           // 화살 사거리 / 속도
    ARCHER_COUNT: 1, ARCHER_AGGRO: 30, ARCHER_FIRE_INTERVAL: 1.5,   // 궁수 동료 수 / 인식 거리 / 발사 간격(초)
    CORRIDOR_WIDTH: 3.2,                       // 성벽 양옆으로 자원을 치우는 폭 (NPC 통행로)
    GATE_REACH: 2.0, GATE_BAND: 2.5, GATE_GRACE: 3,   // 출입구 도달 반경 / 성벽 위 목표 판정 폭 / 통과 후 재경유 금지 시간(초)
    BUILD_TIME: 2, REPAIR_TIME: 1.5, GATHER_TIME: 1,   // 동료의 작업 시간(초). 채집은 플레이어와 동일(1초)
    PLAYER_GATHER_TIME: 1,                     // 플레이어 채집 딜레이(초) - 이동하면 취소
    MELEE_AGGRO: 45,                           // 근접 동료의 야간 적 인식 거리 (성벽 밖까지)
    FENCE_UPGRADE_STONE: 5,                    // 돌 성벽 업그레이드 비용(돌)
    FENCE_HP: 30, WALL_HP: 100,                // 나무 목책 / 돌 성벽 체력
    // 구조물 파괴력 (초당 데미지): 적 종류 x 구조물 종류 로 분리
    STRUCT_DPS: { normal: { wood: 10, stone: 10 }, brute: { wood: 20, stone: 35 }, boss: { wood: 80, stone: 80 } },
    RESPAWN_HOUR: 6,                           // 매일 이 시각에 부족한 자원 리스폰
    // 웨이브 / 난이도: 밤마다 총 마릿수 = WAVE_BASE + Day * WAVE_PER_DAY
    WAVE_BASE: 3, WAVE_PER_DAY: 2,
    SPAWN_INTERVAL_BASE: 6, SPAWN_RATE_GROWTH: 0.3, MIN_SPAWN_INTERVAL: 0.6,   // 간격 = BASE / (1 + GROWTH*(Day-1))
    MAX_ALIVE: 30,                             // 동시에 존재할 수 있는 적 수
    // 브루트 (Day 2부터, 웨이브 마지막에 등장)
    BRUTE_FROM_DAY: 2, BRUTE_HP: 10, BRUTE_SCALE: 1.5, BRUTE_SPEED_MUL: 0.7, BRUTE_CONTACT_DMG: 25, ENEMY_CONTACT_DMG: 10,
    KNOCKBACK: 0.7, KNOCKBACK_UPGRADED: 1.6, BRUTE_KNOCKBACK_MUL: 0.7,   // 넉백 거리 (무기 강화 시 증가)
    ENEMY_HP: 2,                               // 적 체력
    // 무기 데미지: 검은 근접(고위험·고화력), 활은 안전하지만 약함. 무기 강화는 검에만 적용된다.
    BOW_DMG: 1,                                // 기본 활 데미지 (화살 데미지가 지정되지 않았을 때)
    // 장비 데이터: cost가 있는 것은 대장간에서 제작. 병사는 대장간에서 직접 수령(Equip)한다. tier가 높을수록 상위 장비
    GEAR: {
      sword_basic: { slot: 'sword', name: 'Sword', short: 'Sword', dmg: 2, tier: 0, color: 0xc9ced6, slash: 1, slashColor: 0xffffff },
      iron_sword: { slot: 'sword', name: 'Iron Sword', short: 'Iron Sword', dmg: 4, tier: 1, color: 0x9fc4ff, slash: 1.5, slashColor: 0x4aa8ff, cost: { stone: 10, iron: 5 }, desc: 'Damage 4 · Wider slash · Stronger knockback' },
      steel_sword: { slot: 'sword', name: 'Steel Sword', short: 'Steel Sword', dmg: 6, tier: 2, age: 3, color: 0xdfe8ff, slash: 1.8, slashColor: 0xc08aff, cost: { stone: 20, iron: 12 }, desc: 'Damage 6 · Huge slash · Age 3' },
      bow_basic: { slot: 'bow', name: 'Bow', short: 'Bow', dmg: 1, tier: 0, color: 0x8a5a2b },
      strong_bow: { slot: 'bow', name: 'Reinforced Bow', short: 'Bow+', dmg: 2, tier: 1, color: 0x5a3a1a, cost: { wood: 12, iron: 4 }, desc: 'Arrow damage 2 · Iron-tipped limbs' },
      steel_bow: { slot: 'bow', name: 'Steel Bow', short: 'Steel Bow', dmg: 3, tier: 2, age: 3, color: 0xb9c4d6, cost: { wood: 25, iron: 10 }, desc: 'Arrow damage 3 · Age 3' },
      beacon_blade: { slot: 'sword', name: 'Beacon Blade', short: 'Beacon Blade', dmg: 9, tier: 3, age: 3, req: 'dawn', color: 0xfff0b0, slash: 2.1, slashColor: 0xffd54a, cost: { iron: 20, shard: 3 }, desc: 'Damage 9 · Enormous golden slash · After the Dawn Gate' },
      beacon_bow: { slot: 'bow', name: 'Beacon Bow', short: 'Beacon Bow', dmg: 4, tier: 3, age: 3, req: 'dawn', color: 0xffe08a, cost: { wood: 30, iron: 14, shard: 3 }, desc: 'Arrow damage 4 · After the Dawn Gate' },
      beacon_armor: { slot: 'armor', name: 'Beacon Armor', short: 'Beacon', reduce: 0.55, tier: 3, age: 3, req: 'dawn', color: 0xffe9b0, cost: { stone: 20, iron: 16, shard: 4 }, desc: 'Take 55% less damage · After the Dawn Gate' },
      armor_none: { slot: 'armor', name: 'No armor', short: 'None', reduce: 0, tier: 0 },
      iron_armor: { slot: 'armor', name: 'Iron Armor', short: 'Iron', reduce: 0.25, tier: 1, color: 0x8a919c, cost: { stone: 8, iron: 6 }, desc: 'Take 25% less damage' },
      steel_armor: { slot: 'armor', name: 'Steel Armor', short: 'Steel', reduce: 0.4, tier: 2, age: 3, color: 0xc9d6ea, cost: { stone: 16, iron: 12 }, desc: 'Take 40% less damage · Age 3' },
    },
    // 방패병 (Day 3부터): 화살 면역, 검/근접 동료 돌진에만 피해
    SHIELD_FROM_DAY: 3, SHIELD_CHANCE: 0.3, SHIELD_HP: 3, SHIELD_SPEED_MUL: 0.9,
    HP_SCALE_EVERY: 2,                         // 모든 적 최대 HP가 N일마다 +1 (보너스 = floor((Day-1)/N))
  };
  for (const id in CFG.GEAR) CFG.GEAR[id].id = id;
