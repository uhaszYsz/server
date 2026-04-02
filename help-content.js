// server/help-content.js
// Export help content as BBCode for forum initialization

export const specialKeywordsHelp = [
    {
        name: 'background',
        threadTitle: 'background(name, dynamic, width, height)',
        content: `Creates or updates a named background layer. Use this block to draw into that layer, then show it with drawBackground().

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]Required. Background name used later in drawBackground(x, y, name, ...).[/i]
[color=#9acd32]dynamic[/color] - [i]Optional. false/omitted = static cache (draw once, reuse). true = redraw every frame while this block runs.[/i]
[color=#9acd32]width, height[/color] - [i]Optional. Local canvas size for dynamic backgrounds (for example 200, 400).[/i]

[b]Example (static):[/b]
[code]background("bg1")
#drawCircle(90, 160, 4, 0, "#FF0000")
#drawText(50, 100, "Hello", "#FFFFFF", 12)
drawBackground(0, 0, "bg1")[/code]
[i]Build once, reuse every frame.[/i]

[b]Example (dynamic):[/b]
[code]background("parallax", true)
#drawSprite(90 + timeFrames * 0.2, 160, "@cloud", 1, 1, 0)
drawBackground(0, 0, "parallax")[/code]
[i]Rebuilds each frame so moving visuals update.[/i]

[b]Example (dynamic with size):[/b]
[code]background("ui", true, 200, 400)
#drawRectangle(0, 0, 200, 400, "#112233")
drawBackground(90, 160, "ui", 0, null, 5)[/code]`
    },
    {
        name: 'def',
        content: `Defines a variable with a starting value that is kept from frame to frame.

[b]Example:[/b]
[code]def myVar = 10;
def myString = "hello";[/code]
[i]Defines two variables that persist across frames.[/i]`
    },
    {
        name: 'globalvar',
        content: `Defines a variable that is set once and then shared by every object in the game.

[b]Example:[/b]
[code]globalvar score = 0;

// In any object:
score += 1;[/code]
[i]Creates a shared score counter accessible from every object.[/i]`
    },
    {
        name: 'inBullet',
        threadTitle: 'inBullet(id)',
        content: `Selects bullets, then runs the indented block once per selected bullet so you can read/write bullet fields (Speed, Direction, Alpha, Color, etc).

[b]Arguments:[/b]
[color=#9acd32]id[/color] - [i]Optional selector.[/i]
[i]- Omit: same as [color=#ffa500]inBullet(myBullets)[/color] (only bullets created by this object).[/i]
[i]- Number: one bullet ID (for example the value returned by createBullet).[/i]
[i]- List/array of IDs: affects each listed bullet.[/i]
[i]- [color=#ffa500]bulletData[/color]: affects all bullets in the world.[/i]

[b]Examples:[/b]
[code]var Id = createBullet(x, y, { Speed: 5, Direction: direction, Size: 2 })
inBullet(Id)
#Alpha = 0.2[/code]
[i]Sets Alpha for one bullet by ID.[/i]

[code]inBullet()
#Speed = Speed * 0.98[/code]
[i]Slows only this object's bullets.[/i]

[code]inBullet(bulletData)
#Color = "#66ccff"[/code]
[i]Tints every bullet in the game.[/i]`
    },
    // inObject has been removed from the language; help entry deleted.
    {
        name: 'repeat',
        threadTitle: 'repeat(n)',
        content: `Runs the indented block [b]n[/b] times in the same frame.

[b]Signature:[/b] [color=#90ee90]repeat(n)[/color]

[b]Arguments:[/b]
[b][color=#90ee90]n[/color][/b] - [i]How many times the block runs.[/i]

No built-in loop index is provided; create your own counter when needed (for example [color=#ffa500]var i = 0[/color] before the block, [color=#ffa500]#i++[/color] inside).

[b]Example:[/b]
[code]var i = 0
repeat(5)
#createBullet(x, y, { Speed: 5, Direction: direction - 15*i })
#i++[/code]
[i]Spawns 5 bullets this frame with angle spread.[/i]`
    },
    {
        name: 'interval',
        threadTitle: 'interval(frames, runs, startTime)',
        content: `Runs codes each x frames.

[b]Arguments:[/b]
[b][color=#90ee90]frames[/color][/b] - [i]How many frames to wait between each run.[/i]
[color=#87ceeb]runs[/color] - [i]Optional; default -1 = infinite. Use 1 to run once, or N to run N times then stop.[/i]
[color=#9acd32]startTime[/color] - [i]Optional; the first run happens after this many frames, then every frames after that.[/i]

[b]Example:[/b]
[code]if interval(20)
#if x > 20
##hp++
if interval(10, -1, 4)
#createBullet(x, y, { Speed: 2, Direction: 0, Size: 1 })
interval(20, 5, 0)
#createBullet(x, y)[/code]
[i]First block every 20 frames. Second: first fire in 4 frames, then every 10. Third: fire 5 times then stop.[/i]`
    }
];

export const builtInVariablesHelp = [
    {
        name: 'player',
        content: `The player object you can read from (position, health, knockback, etc). 
[b]Properties:[/b] [color=#ffa500]x[/color], [color=#ffa500]y[/color], [color=#ffa500]hp[/color], [color=#ffa500]knockbackTime[/color], [color=#ffa500]knockbackPower[/color], [color=#ffa500]knockbackDirection[/color]`
    },
    {
        name: 'bulletData',
        content: `Raw bullet buffer for the whole game. To loop [b]every[/b] bullet, use [color=#ffa500]inBullet(bulletData)[/color]. [color=#ffa500]inBullet()[/color] with no argument only affects [b]this object's[/b] bullets (same as [color=#ffa500]inBullet(myBullets)[/color]). The game removes bullets when they hit or leave the play area.

[b]Properties:[/b]
[color=#ffa500]Id[/color] - [i]The bullet's unique ID for deleteBullet or inBullet.[/i]
[color=#ffa500]X[/color], [color=#ffa500]Y[/color] - [i]Where the bullet is in the world.[/i]
[color=#ffa500]Vx[/color], [color=#ffa500]Vy[/color] - [i]Internal; use Speed and Direction instead.[/i]
[color=#ffa500]Speed[/color] - [i]How far the bullet moves each frame in its direction.[/i]
[color=#ffa500]Direction[/color] - [i]Which way it moves (0–360, 0 is right).[/i]
[color=#ffa500]Color[/color] - [i]The bullet's color (e.g. "#FF0000" for red).[/i]
[color=#ffa500]Alpha[/color] - [i]How see-through it is from 0 (invisible) to 1 (solid).[/i]
[color=#ffa500]Size[/color] - [i]How big the bullet is.[/i]
[color=#ffa500]ScaleY[/color] - [i]Vertical stretch (1 is round, less than 1 is squashed).[/i]
[color=#ffa500]Rotation[/color] - [i]How much it is rotated (internal).[/i]
[color=#ffa500]Lifetime[/color] - [i]How many frames it lasts; -1 means forever.[/i]
[color=#ffa500]Homing[/color] - [i]How strongly it turns toward the player.[/i]
[color=#ffa500]Spin[/color] - [i]How fast it spins each frame.[/i]
[color=#ffa500]Shape[/color] - [i]Shape index: circle, square, triangle, diamond, star, or cross.[/i]
[color=#ffa500]Type[/color] - [i]Whether it is a player or enemy bullet (in bulletTypes).[/i]
[color=#ffa500]Surface[/color] - [i]Which drawing layer it is on ("main" is default).[/i]
[color=#ffa500]GlowSize[/color] - [i]How big the glow is (-1 uses default).[/i]
[color=#ffa500]GlowPower[/color] - [i]How bright the glow is from 0 to 1 (-1 uses default).[/i]
[color=#ffa500]ColorGlow[/color] - [i]The color of the glow (e.g. "#FF0000").[/i]`
    },
    {
        name: 'bulletCount',
        content: `How many bullets are currently on screen.`
    },
    {
        name: 'fpsLimit',
        content: `[b]Writable.[/b] Target game FPS (frames per second). Default [color=#ffa500]30[/color]. You can set it at runtime to limit or increase FPS (e.g. [color=#ffa500]fpsLimit = 60[/color] or [color=#ffa500]fpsLimit = 15[/color]). Clamped to 1-120.`
    },
    {
        name: 'worldX',
        content: `[b]Read-only.[/b] World width in pixels (e.g. [color=#ffa500]180[/color]). Same as the play area width. Global built-in.`
    },
    {
        name: 'worldY',
        content: `[b]Read-only.[/b] World height in pixels (e.g. [color=#ffa500]321[/color]). Same as the play area height. Global built-in.`
    },
    {
        name: 'timeFrames',
        content: `[b]Read-only.[/b] Total frames elapsed since the room/run started. Use for timing (e.g. [color=#ffa500]timeFrames % 60[/color] for once per second at 60 FPS). Global built-in.`
    },
    {
        name: 'tapX',
        content: `Where the player tapped or clicked on the screen (horizontal).`
    },
    {
        name: 'tapY',
        content: `Where the player tapped or clicked on the screen (vertical).`
    },
    {
        name: 'x',
        content: `This object's horizontal position in the world.`
    },
    {
        name: 'y',
        content: `This object's vertical position in the world.`
    },
    {
        name: 'speed',
        content: `How fast this object is moving.`
    },
    {
        name: 'direction',
        content: `Which way this object is facing (in degrees).`
    },
    {
        name: 'id',
        content: `This object's unique ID.`
    },
    {
        name: 'myBullets',
        content: `The list of bullets this object created; use [color=#ffa500]inBullet(myBullets)[/color] or [color=#ffa500]inBullet()[/color] to change only those bullets. The list is kept when your code references [b]myBullets[/b] or uses [b]inBullet()[/b] with no argument.

[b]Use:[/b]
[code]inBullet(myBullets)
#Alpha = 0.5[/code]
[i]Affects only bullets created by this object.[/i]

[b]Count:[/b] Use [color=#ffa500]myBullets.length[/color].

[b]Example:[/b]
[code]createBullet(x, y, { Speed: 5, Direction: direction, Size: 2 })
inBullet(myBullets)
#Speed = 3
if (myBullets.length > 10)
#deleteBullet(Id)[/code]`
    },
    {
        name: 'initials',
        content: `[b]Read-only.[/b] Object holding the [b]initial values[/b] of this object at creation: [color=#ffa500]x[/color], [color=#ffa500]y[/color], [color=#ffa500]speed[/color], [color=#ffa500]direction[/color], [color=#ffa500]depth[/color], and any [b]def[/b] variables.

[b]Use:[/b] Read starting values or reset (e.g. [color=#ffa500]x = initials.x[/color], [color=#ffa500]speed = initials.speed[/color]).`
    },
    {
        name: 'snapshoots',
        content: `[b]Object[/b] of saved [b]def[/b] variable states (empty by default). [color=#ffa500]snapshootMake("name")[/color] saves current def vars under that name; [color=#ffa500]snapshootRestore("name")[/color] restores them. Access in interpreter: [color=#ffa500]snapshoots.myname[/color] or [color=#ffa500]snapshoots["myname"][/color].`
    },
    {
        name: 'snapshootMake',
        content: `Saves the current state of all [b]def[/b] variables under the given name. Example: [color=#ffa500]snapshootMake("start")[/color]. Stored in [color=#ffa500]snapshoots[/color].`
    },
    {
        name: 'snapshootRestore',
        content: `Restores all [b]def[/b] variables from a previously saved snapshot. Example: [color=#ffa500]snapshootRestore("start")[/color]. No-op if the name does not exist.`
    }
];

export const danmakuHelpersHelp = [
    {
        name: 'getSelf',
        threadTitle: 'getSelf()',
        content: `Returns the object that is running this code so you can read or change its properties.

[b][color=#ffa500]Returns: the current running object.[/color][/b]

[b]Example:[/b]
[code]var self = getSelf();
self.x = 0;
self.speed = 2;[/code]`
    },
    {
        name: 'getDirection',
        threadTitle: 'getDirection(targetX, targetY)',
        content: `Gives the angle in degrees from this object's position to a target point.

[b]Arguments:[/b]
[b][color=#90ee90]targetX[/color][/b] - [i]The target's horizontal position.[/i]
[b][color=#90ee90]targetY[/color][/b] - [i]The target's vertical position.[/i]

[b][color=#ffa500]Returns: the angle in degrees (0-360).[/color][/b]

[b]Example:[/b]
[code]var dir = getDirection(100, 200);[/code]`
    },
    {
        name: 'getDirectionFromTo',
        threadTitle: 'getDirectionFromTo(fromX, fromY, toX, toY)',
        content: `Gives the angle in degrees from one point to another.

[b]Arguments:[/b]
[b][color=#90ee90]fromX, fromY[/color][/b] - [i]The starting point.[/i]
[b][color=#90ee90]toX, toY[/color][/b] - [i]The end point.[/i]

[b]Example:[/b]
[code]var dir = getDirectionFromTo(lx, ly, x, y);[/code]`
    },
    {
        name: 'getDistanceFromTo',
        threadTitle: 'getDistanceFromTo(fromX, fromY, toX, toY)',
        content: `Gives the distance between two points.

[b]Arguments:[/b]
[b][color=#90ee90]fromX, fromY[/color][/b] - [i]The first point.[/i]
[b][color=#90ee90]toX, toY[/color][/b] - [i]The second point.[/i]

[b]Example:[/b]
[code]var d = getDistanceFromTo(lx, ly, x, y);[/code]`
    },
    {
        name: 'normalizeAngle',
        threadTitle: 'normalizeAngle(angleDeg)',
        content: `Puts an angle into the 0–360 range (e.g. -90 becomes 270, 450 becomes 90).

[b]Arguments:[/b]
[b][color=#90ee90]angleDeg[/color][/b] - [i]The angle in degrees to normalize.[/i]

[b][color=#ffa500]Returns:[/color][/b] the angle as a number between 0 and 360.
[b]Example:[/b]
[code]direction = normalizeAngle(450); // returns 90[/code]`
    },
    {
        name: 'angleDifference',
        threadTitle: 'angleDifference(fromAngle, toAngle)',
        content: `Gives the shortest angle between two directions in degrees.

[b]Arguments:[/b]
[b][color=#90ee90]fromAngle[/color][/b] - [i]The starting angle in degrees.[/i]
[b][color=#90ee90]toAngle[/color][/b] - [i]The target angle in degrees.[/i]

[b][color=#ffa500]Returns: the angle difference (can be negative).[/color][/b]

[b]Example:[/b]
[code]var diff = angleDifference(0, 270); // returns -90[/code]`
    },
    {
        name: 'getDistance',
        threadTitle: 'getDistance(targetX, targetY)',
        content: `Gives the distance from this object to a target point.

[b]Arguments:[/b]
[b][color=#90ee90]targetX[/color][/b] - [i]The target's horizontal position.[/i]
[b][color=#90ee90]targetY[/color][/b] - [i]The target's vertical position.[/i]

[b][color=#ffa500]Returns: the distance.[/color][/b]

[b]Example:[/b]
[code]var dist = getDistance(100, 200);[/code]`
    },
    {
        name: 'lenDirX',
        threadTitle: 'lenDirX(length, direction)',
        content: `Gives the horizontal part of a distance in a given direction.

[b]Arguments:[/b]
[b][color=#90ee90]length[/color][/b] - [i]The distance or length.[/i]
[b][color=#90ee90]direction[/color][/b] - [i]The direction in degrees.[/i]

[b][color=#ffa500]Returns: the horizontal offset.[/color][/b]

[b]Example:[/b]
[code]var offsetX = lenDirX(10, 90); // returns 0 (straight up)[/code]`
    },
    {
        name: 'lenDirY',
        threadTitle: 'lenDirY(length, direction)',
        content: `Gives the vertical part of a distance in a given direction.

[b]Arguments:[/b]
[b][color=#90ee90]length[/color][/b] - [i]The distance or length.[/i]
[b][color=#90ee90]direction[/color][/b] - [i]The direction in degrees.[/i]

[b][color=#ffa500]Returns: the vertical offset.[/color][/b]

[b]Example:[/b]
[code]var offsetY = lenDirY(10, 90); // returns 10 (straight up)[/code]`
    },
    {
        name: 'lenDir',
        threadTitle: 'lenDir(length, direction)',
        content: `Returns both horizontal and vertical parts of a distance in a given direction as one object.

[b]Arguments:[/b]
[b][color=#90ee90]length[/color][/b] - [i]The distance or length.[/i]
[b][color=#90ee90]direction[/color][/b] - [i]The direction in degrees.[/i]

[b][color=#ffa500]Returns: an object with .x and .y (same as lenDirX and lenDirY).[/color][/b]

[b]Example:[/b]
[code]var ldx = lenDir(10, 90).x;
var off = lenDir(10, 90);
var ldy = off.y;[/code]`
    },
    {
        name: 'lerp',
        threadTitle: 'lerp(a, b, t)',
        content: `Linearly interpolates between two values.

[b]Arguments:[/b]
[b][color=#90ee90]a[/color][/b] - [i]Start value.[/i]
[b][color=#90ee90]b[/color][/b] - [i]End value.[/i]
[b][color=#90ee90]t[/color][/b] - [i]Blend amount (usually 0..1).[/i]

[b][color=#ffa500]Returns:[/color][/b] [i]a + (b - a) * t[/i].

[b]Example:[/b]
[code]x = lerp(x, player.x, 0.1);      // smooth follow
var v = lerp(0, 100, 0.25); // 25[/code]`
    },
    {
        name: 'hsvToHex',
        threadTitle: 'hsvToHex(h, s, v)',
        content: `Turns hue, saturation, and brightness into a color code string.

[b]Arguments:[/b]
[b][color=#90ee90]h[/color][/b] - [i]Hue from 0 to 360.[/i]
[b][color=#90ee90]s[/color][/b] - [i]Saturation from 0 to 1 or 0 to 100.[/i]
[b][color=#90ee90]v[/color][/b] - [i]Brightness from 0 to 1 or 0 to 100.[/i]

[b][color=#ffa500]Returns: a color code string.[/color][/b]

[b]Example:[/b]
[code]var color = hsvToHex(200, 0.8, 1); // blue[/code]`
    },
    {
        name: 'move',
        threadTitle: 'move(length, direction)',
        content: `Moves this object a given distance in a given direction and updates its position.

[b]Arguments:[/b]
[b][color=#90ee90]length[/color][/b] - [i]How far to move.[/i]
[b][color=#90ee90]direction[/color][/b] - [i]The direction in degrees.[/i]

[b]Example:[/b]
[code]move(5, 90); // moves 5 units upward
move(10, 0); // moves 10 units to the right[/code]`
    },
    {
        name: 'isUndef',
        threadTitle: 'isUndef(v)',
        content: `Tells you whether a value or variable is undefined or not set.

[b]Arguments:[/b]
[b][color=#90ee90]v[/color][/b] - [i]The value or variable to check.[/i]

[b][color=#ffa500]Returns:[/color][/b] true if undefined, false otherwise.
[b]Example:[/b]
[code]if (isUndef(myVar)) { /* variable is undefined or not declared */ }[/code]`
    },
    {
        name: 'rand',
        threadTitle: 'rand(min, max)',
        content: `Picks a random number between the minimum and maximum (both included).

[b]Arguments:[/b]
[b][color=#90ee90]min[/color][/b] - [i]The smallest possible value.[/i]
[b][color=#90ee90]max[/color][/b] - [i]The largest possible value.[/i]

[b][color=#ffa500]Returns: a random number in that range.[/color][/b]

[b]Example:[/b]
[code]var value = rand(-100, 100); // random number between -100 and 100[/code]`
    },
    {
        name: 'choose',
        threadTitle: 'choose(...values)',
        content: `Picks one value at random from the values you pass in (each has equal chance).

[b]Arguments:[/b]
[b][color=#90ee90]values[/color][/b] - [i]Any list of values (numbers, text, etc.).[/i]

[b][color=#ffa500]Returns: one of those values, chosen at random.[/color][/b]

[b]Example:[/b]
[code]var dir = choose(0, 90, 180, 270); // random direction
var speed = choose(3, 5, 8); // random speed[/code]`
    },
    {
        name: 'listShuffle',
        threadTitle: 'listShuffle(arr)',
        content: `Randomly reorders the items in a list and returns that same list.

[b]Arguments:[/b]
[b][color=#90ee90]arr[/color][/b] - [i]The list to shuffle.[/i]

[b][color=#ffa500]Returns: the same list in random order.[/color][/b]

[b]Example:[/b]
[code]var items = [1, 2, 3, 4, 5];
listShuffle(items); // items is now randomly ordered[/code]`
    },
    {
        name: 'listFilterOut',
        threadTitle: 'listFilterOut(array, value)',
        content: `Removes every copy of a value from a list and returns the list.

[b]Arguments:[/b]
[b][color=#90ee90]array[/color][/b] - [i]The list to change.[/i]
[b][color=#90ee90]value[/color][/b] - [i]The value to remove everywhere.[/i]

[b][color=#ffa500]Returns: the same list with those values gone.[/color][/b]

[b]Example:[/b]
[code]var list = [1, 22, 3, 22];
listFilterOut(list, 22); // list is now [1, 3][/code]`
    },
    {
        name: 'listAdd',
        threadTitle: 'listAdd(array, value)',
        content: `Adds a value to the end of a list and returns the list.

[b]Arguments:[/b]
[b][color=#90ee90]array[/color][/b] - [i]The list to add to.[/i]
[b][color=#90ee90]value[/color][/b] - [i]The value to add.[/i]

[b][color=#ffa500]Returns: the same list with the value at the end.[/color][/b]

[b]Example:[/b]
[code]var list = [1, 2]; listAdd(list, 3); // list is now [1, 2, 3][/code]`
    },
    {
        name: 'listFind',
        threadTitle: 'listFind(array, value)',
        content: `Finds the first position of a value in a list.

[b]Arguments:[/b]
[b][color=#90ee90]array[/color][/b] - [i]The list to search.[/i]
[b][color=#90ee90]value[/color][/b] - [i]The value to look for.[/i]

[b][color=#ffa500]Returns: the position (0-based) or -1 if not found.[/color][/b]

[b]Example:[/b]
[code]var i = listFind([1, 22, 3], 22); // returns 1[/code]`
    },
    {
        name: 'listPop',
        threadTitle: 'listPop(array)',
        content: `Removes the last item from a list and returns that item.

[b]Arguments:[/b]
[b][color=#90ee90]array[/color][/b] - [i]The list to take from.[/i]

[b][color=#ffa500]Returns: the last item, or undefined if the list is empty.[/color][/b]

[b]Example:[/b]
[code]var last = listPop(list); // removes last, returns it[/code]`
    },
    {
        name: 'listRemove',
        threadTitle: 'listRemove(array, value)',
        content: `Removes every copy of a value from a list and returns the list.

[b]Arguments:[/b]
[b][color=#90ee90]array[/color][/b] - [i]The list to change.[/i]
[b][color=#90ee90]value[/color][/b] - [i]The value to remove everywhere.[/i]

[b][color=#ffa500]Returns: the same list with those values gone.[/color][/b]

[b]Example:[/b]
[code]listRemove(list, 22); // removes all 22s[/code]`
    },
    {
        name: 'isEnemy',
        threadTitle: 'isEnemy()',
        content: `Marks this object as an enemy so it appears in the global enemy list.

[b]Example:[/b]
[code]isEnemy(); // mark this object as an enemy[/code]`
    },
    {
        name: 'enemyList',
        threadTitle: 'enemyList()',
        content: `Returns a list of all objects currently marked as enemies.

[b][color=#ffa500]Returns: the list of all active enemies.[/color][/b]

[b]Example:[/b]
[code]var enemies = enemyList();
for(var i=0; i<enemies.length; i++) {
  var e = enemies[i];
  // do something with enemy
}[/code]`
    },
    {
        name: 'init',
        content: `Use this to run code only once when the object is first created.

[b][color=#ffa500]Returns: true only on the first frame, then false from then on.[/color][/b]

[b]Example:[/b]
[code]if (init()) { /* danmakuINIT is undefined */ }[/code]`
    },
    {
        name: 'turnTowards',
        threadTitle: 'turnTowards(direction, targetDirection, maxTurn)',
        content: `Returns a new direction that turns toward a target, but only by up to maxTurn degrees (does not change any variable by itself).

[b]Arguments:[/b]
[b][color=#90ee90]direction[/color][/b] - [i]The current direction in degrees.[/i]
[b][color=#90ee90]targetDirection[/color][/b] - [i]The direction you want to face.[/i]
[b][color=#90ee90]maxTurn[/color][/b] - [i]The most degrees it can turn in one step.[/i]

[b][color=#ffa500]Returns: the new direction in degrees (0–360).[/color][/b]

[b]Example:[/b]
[code]direction = turnTowards(direction, 90, 5); // turn up to 5° towards 90
direction = turnTowards(direction, getDirection(target.x, target.y), 5);[/code]`
    },
    {
        name: 'turnTowardsPlayer',
        threadTitle: 'turnTowardsPlayer(maxTurn)',
        content: `Returns a new direction that turns this object toward the player, limited by maxTurn degrees (does not change any variable by itself).

[b]Arguments:[/b]
[b][color=#90ee90]maxTurn[/color][/b] - [i]The most degrees it can turn in one step.[/i]

[b][color=#ffa500]Returns: the new direction in degrees (0–360).[/color][/b]

[b]Example:[/b]
[code]direction = turnTowardsPlayer(5);[/code]`
    },
    {
        name: 'directionBounce',
        threadTitle: 'directionBounce(direction, horizontal)',
        content: `Returns the direction after bouncing off a wall (does not change any variable by itself).

[b]Arguments:[/b]
[b][color=#90ee90]direction[/color][/b] - [i]The current direction in degrees.[/i]
[b][color=#90ee90]horizontal[/color][/b] - [i]true = bounce off a vertical wall (left/right; flips vx). false = bounce off a horizontal wall (top/bottom; flips vy).[/i]

[b][color=#ffa500]Returns: the new direction in degrees (0–360).[/color][/b]

[b]Example:[/b]
[code]direction = directionBounce(direction, true);  // hit left or right wall
direction = directionBounce(direction, false); // hit top or bottom wall[/code]`
    },
    {
        name: 'waveStart',
        threadTitle: 'waveStart(waveNumber)',
        content: `Starts the wave with the given number from the stage editor.

[b]Arguments:[/b]
[b][color=#90ee90]waveNumber[/color][/b] - [i]The wave number from the stage editor.[/i]

[b][color=#ffa500]Returns: true if that wave exists and was started, false otherwise.[/color][/b]

[b]Example:[/b]
[code]waveStart(1); // select Wave 1
waveStart(2); // select Wave 2[/code]`
    },
    {
        name: 'waveGetCurrent',
        threadTitle: 'waveGetCurrent()',
        content: `Tells you which wave number is currently active.

[b][color=#ffa500]Returns: the current wave number.[/color][/b]

[b]Example:[/b]
[code]var w = waveGetCurrent();
drawText(5, 5, "Wave: " + w);[/code]`
    },
    {
        name: 'waveGet',
        threadTitle: 'waveGet()',
        content: `Returns the current wave number (alias of waveGetCurrent()).

[b][color=#ffa500]Returns: the current wave number.[/color][/b]

[b]Example:[/b]
[code]var w = waveGet();
drawText(5, 5, "Wave: " + w);[/code]`
    },
    {
        name: 'waveStartNext',
        threadTitle: 'waveStartNext()',
        content: `Switches to the next wave in the stage editor.

[b][color=#ffa500]Returns: true if it switched, false otherwise.[/color][/b]

[b]Example:[/b]
[code]waveStartNext();[/code]`
    },
    {
        name: 'drawCircle',
        threadTitle: 'drawCircle(x, y, size, outlineWidth, color, gradient, yScale, angle)',
        content: `Draws a circle or ellipse at a position with optional outline, color, gradient, vertical scale, and rotation.

[b]Arguments:[/b]
[b][color=#90ee90]x, y[/color][/b] - [i]Center position.[/i]
[b][color=#90ee90]size[/color][/b] - [i]Radius.[/i]
[color=#9acd32]outlineWidth[/color] - [i]Optional; 0 = filled, or outline thickness.[/i]
[color=#9acd32]color[/color] - [i]Optional hex or [r,g,b] (e.g. "#ff0000").[/i]
[color=#9acd32]gradient[/color] - [i]Optional edge fade 0..1.[/i]
[color=#9acd32]yScale[/color] - [i]Optional; 1 = circle, 2 = oval 2x taller, 0.5 = wider.[/i]
[color=#9acd32]angle[/color] - [i]Optional rotation in degrees (e.g. 45 to rotate the oval).[/i]

[b]Example:[/b]
[code]drawCircle(100, 200, 5);
drawCircle(100, 200, 5, 0, "#ff0000", 0.2, 2);   // red ellipse 2x taller
drawCircle(100, 200, 5, 0, "#ff0000", 0.2, 2, 45); // same oval rotated 45°[/code]`
    },
    {
        name: 'drawRectangle',
        threadTitle: 'drawRectangle(x, y, w, h, color)',
        content: `Draws a rectangle with its bottom-left corner at the given position and optional color.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the bottom-left corner.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the bottom-left corner.[/i]
[b][color=#90ee90]w[/color][/b] - [i]Width of the rectangle.[/i]
[b][color=#90ee90]h[/color][/b] - [i]Height of the rectangle.[/i]
[color=#9acd32]color[/color] - [i]Optional color (e.g. "#ff0000").[/i]

[b]Example:[/b]
[code]drawRectangle(10, 20, 50, 30); // white rectangle
// or drawRectangle(10, 20, 50, 30, "#ff0000"); // red rectangle
// or drawRectangle(10, 20, 50, 30, [1.0, 0.0, 0.0, 0.5]); // red rectangle with 50% opacity[/code]`
    },
    {
        name: 'drawLine',
        threadTitle: 'drawLine(x1, y1, x2, y2, width, color)',
        content: `Draws a line from one point to another with optional thickness and color.

[b]Arguments:[/b]
[b][color=#90ee90]x1[/color][/b] - [i]Horizontal position of the start.[/i]
[b][color=#90ee90]y1[/color][/b] - [i]Vertical position of the start.[/i]
[b][color=#90ee90]x2[/color][/b] - [i]Horizontal position of the end.[/i]
[b][color=#90ee90]y2[/color][/b] - [i]Vertical position of the end.[/i]
[color=#9acd32]width[/color] - [i]Optional line thickness (default 1).[/i]
[color=#9acd32]color[/color] - [i]Optional color.[/i]

[b]Example:[/b]
[code]drawLine(10, 20, 100, 150); // white line
// or drawLine(10, 20, 100, 150, 2); // line width 2
// or drawLine(10, 20, 100, 150, 1, "#ff0000"); // red line[/code]`
    },
    {
        name: 'inverseKinematics',
        threadTitle: 'inverseKinematics(x, y, xTar, yTar, links)',
        content: `Builds a chain from a start point to a target and draws it as segments and joints, returning the position and angle of each segment.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the start of the chain.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the start of the chain.[/i]
[b][color=#90ee90]xTar[/color][/b] - [i]Horizontal position of the target (end of chain).[/i]
[b][color=#90ee90]yTar[/color][/b] - [i]Vertical position of the target.[/i]
[b][color=#90ee90]links[/color][/b] - [i]Number of segments (same length) or a list of segment lengths.[/i]

[b]Returns:[/b] A list of objects with x, y, and direction for each segment.

[b]Example:[/b]
[code]var bones = inverseKinematics(x, y, 100, 80, 5);
// 8 bones with custom lengths:
var bones = inverseKinematics(x, y, xTar, yTar, [10, 12, 14, 16, 18, 14, 12, 10]);
// use: bones[i].x, bones[i].y, bones[i].direction[/code]`
    },
    {
        name: 'drawGround',
        threadTitle: 'drawGround(x, y, w, h, cellW, cellH, color)',
        content: `Draws a grid of rectangles in a region.

[b]Arguments:[/b]
[b][color=#90ee90]x, y[/color][/b] - [i]Left and bottom of the region.[/i]
[b][color=#90ee90]w, h[/color][/b] - [i]Width and height of the region.[/i]
[b][color=#90ee90]cellW, cellH[/color][/b] - [i]Width and height of each grid cell.[/i]
[b][color=#90ee90]color[/color][/b] - [i]Hex string (e.g. "#003E29") or RGBA array [r, g, b, a] (0–1).[/i]

[b]Example (full world):[/b]
[code]drawGround(0, 0, 180, 321, 4, 4, "#003E29");[/code]

[b]Example (region):[/b]
[code]drawGround(0, 0, 90, 160, 4, 4, "#ff0000"); // red grid in left half[/code]`
    },
    {
        name: 'drawLight',
        threadTitle: 'drawLight(x, y, radius, power)',
        content: `Adds a light at a position that brightens nearby ground tiles (closer tiles get brighter).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the light.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the light.[/i]
[color=#9acd32]radius[/color] - [i]Optional how far the light reaches (default 50).[/i]
[color=#9acd32]power[/color] - [i]Optional brightness from 0 to 1 (default 1).[/i]

[b]Example:[/b]
[code]drawLight(90, 160, 50, 1.0); // bright light at center
// or drawLight(x, y, 30, 0.5); // dimmer light with smaller radius[/code]`
    },
    {
        name: 'clearLights',
        threadTitle: 'clearLights()',
        content: `Removes all lights you added this frame (call at the start of each frame to reset).

[b]Example:[/b]
[code]clearLights(); // remove all lights[/code]`
    },
    {
        name: 'didTapped',
        threadTitle: 'didTapped()',
        content: `Tells you whether the screen was just tapped or clicked this frame.

[b][color=#ffa500]Returns: true if tapped this frame, false otherwise.[/color][/b]

[b]Example:[/b]
[code]if (didTapped()) { /* handle tap */ }[/code]`
    },
    {
        name: 'didReleased',
        threadTitle: 'didReleased()',
        content: `Tells you whether the player just lifted their finger or released the mouse this frame.

[b][color=#ffa500]Returns: true if released this frame, false otherwise.[/color][/b]

[b]Example:[/b]
[code]if (didReleased()) { /* handle release */ }[/code]`
    },
    {
        name: 'getPixelColor',
        threadTitle: 'getPixelColor(x, y)',
        content: `Returns the color currently visible at a point in the world (based on what was drawn last frame).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position in the world.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position in the world.[/i]

[b][color=#ffa500]Returns: a color code string, or black if the point is off-screen or unreadable.[/color][/b]

[b]Example:[/b]
[code]var c = getPixelColor(90, 160); // color at center[/code]`
    },
    {
        name: 'sync',
        threadTitle: 'sync(disableVariables)',
        content: `Marks this object so its state is shared with other players in multiplayer (the host sends it to others).

[b]Optional argument:[/b]
[color=#9acd32]disableVariables[/color] - [i]A list of variable names to leave out of syncing (e.g. ["hp", "x"]).[/i]

[b]Example:[/b]
[code]sync(); // mark for MP sync, sync all variables
sync(["hp"]); // sync but exclude hp
sync(["x", "y", "hp"]); // sync but exclude x, y, hp[/code]`
    },
    {
        name: 'drawText',
        threadTitle: 'drawText(x, y, text, color, size)',
        content: `Draws text at a position with optional color and font size.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]text[/color][/b] - [i]The text to show.[/i]
[color=#9acd32]color[/color] - [i]Optional color.[/i]
[color=#9acd32]size[/color] - [i]Optional font size.[/i]

[b]Example:[/b]
[code]drawText(50, 100, "Hello", [255, 0, 0], 12);[/code]`
    },
    {
        name: 'soundPlay',
        threadTitle: 'soundPlay(name, volume, pitch, startMs, endMs)',
        content: `Plays a sound effect from bundled [code]sfx/*.mp3[/code] assets. Arguments are [b]positional only[/b] — always pass [volume] and [pitch] before [startMs] / [endMs].

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]SFX name without extension (friendly names from the sound picker work).[/i]
[color=#9acd32]volume[/color] - [i]Optional volume from 0 to 1 (default 1).[/i]
[color=#9acd32]pitch[/color] - [i]Optional playback rate (1 is normal, max 4).[/i]
[color=#9acd32]startMs[/color] - [i]Optional start time in milliseconds within the clip.[/i]
[color=#9acd32]endMs[/color] - [i]Optional end time in milliseconds (must be greater than startMs).[/i]

[b]Examples:[/b]
[code]soundPlay("explosion");
soundPlay("explosion", 1.0, 1.0);
soundPlay("Laser Impact-01", 1, 1, 50, 200); // 50ms–200ms
soundPlay("hit", 1, 1, 100); // from 100ms to end of file[/code]`
    },
    {
        name: 'drawSprite',
        threadTitle: 'drawSprite(x, y, spriteName, xScale, yScale, rotation, color, align)',
        content: `Draws an image at a position with optional size, rotation, color tint, and which point of the image is at (x,y).

[b]Align grid:[/b] 1=top-left, 2=top-center, 3=top-right, 4=mid-left, 5=center, 6=mid-right, 7=bottom-left, 8=bottom-center, 9=bottom-right.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]spriteName[/color][/b] - [i]The image name (must start with @).[/i]
[b][color=#90ee90]xScale[/color][/b] - [i]Horizontal scale (1 is normal size).[/i]
[b][color=#90ee90]yScale[/color][/b] - [i]Vertical scale (1 is normal size).[/i]
[color=#9acd32]rotation[/color] - [i]Optional rotation in degrees.[/i]
[color=#9acd32]color[/color] - [i]Optional color tint.[/i]
[color=#9acd32]align[/color] - [i]Optional 1–9 for which point of the image is at (x,y); default 5 is center.[/i]

[b]Example:[/b]
[code]drawSprite(90, 160, "@sprite", 1, 1, 45); // center at (90,160), 45° rotation
drawSprite(0, 321, "@ui", 1, 1, 0, null, 1); // top-left at (0,321)[/code]`
    },
    {
        name: 'drawSheetSprite',
        threadTitle: 'drawSheetSprite(x, y, spriteName, frame, maxCellsX, maxCellsY)',
        content: `Draws one frame from an image that contains multiple frames in a grid.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]spriteName[/color][/b] - [i]The sheet image name (must start with @).[/i]
[b][color=#90ee90]frame[/color][/b] - [i]Which frame to show (first is 0).[/i]
[b][color=#90ee90]maxCellsX[/color][/b] - [i]How many frames fit across the sheet.[/i]
[b][color=#90ee90]maxCellsY[/color][/b] - [i]How many frames fit down the sheet.[/i]

[b]Example:[/b]
[code]drawSheetSprite(90, 160, "@spriteSheet", 0, 4, 3); // Draw first frame
drawSheetSprite(90, 160, "@spriteSheet", 5, 4, 3); // Draw frame 5[/code]`
    },
    {
        name: 'drawHealthbar',
        threadTitle: 'drawHealthbar(x, y, width, height, hp, maxHp, depth)',
        content: `Draws a health bar in the world that fills based on current health over max health.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the bottom-left corner.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the bottom-left corner.[/i]
[b][color=#90ee90]width[/color][/b] - [i]Width of the bar.[/i]
[b][color=#90ee90]height[/color][/b] - [i]Height of the bar.[/i]
[b][color=#90ee90]hp[/color][/b] - [i]Current health value.[/i]
[b][color=#90ee90]maxHp[/color][/b] - [i]Maximum health (bar fill = hp divided by maxHp).[/i]
[color=#9acd32]depth[/color] - [i]Optional draw order (default 0).[/i]

[b]Example:[/b]
[code]drawHealthbar(80, 150, 20, 3, 70, 100); // Bar at (80,150), 20x3, 70% full
drawHealthbar(80, 150, 20, 3, 70, 100, 10); // With depth 10[/code]`
    },
    {
        name: 'drawHealthbarUI',
        threadTitle: 'drawHealthbarUI(x, y, width, height, hp, maxHp)',
        content: `Draws a health bar on the UI layer so it appears on top and moves with the camera.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]width[/color][/b] - [i]Width of the bar.[/i]
[b][color=#90ee90]height[/color][/b] - [i]Height of the bar.[/i]
[b][color=#90ee90]hp[/color][/b] - [i]Current health.[/i]
[b][color=#90ee90]maxHp[/color][/b] - [i]Maximum health.[/i]

[b]Example:[/b]
[code]drawHealthbarUI(80, 150, 20, 3, 70, 100); // World bar at (80,150), 20x3, 70% full[/code]`
    },
    {
        name: 'youtubePlay',
        threadTitle: 'youtubePlay(x, y, w, h, url)',
        content: `Shows a YouTube video at a position and size in the world.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the top-left corner.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the top-left corner.[/i]
[b][color=#90ee90]w[/color][/b] - [i]Width of the video area.[/i]
[b][color=#90ee90]h[/color][/b] - [i]Height of the video area.[/i]
[b][color=#90ee90]url[/color][/b] - [i]The YouTube link or video ID.[/i]

[b]Example:[/b]
[code]youtubePlay(50, 200, 80, 60, "dQw4w9WgXcQ");[/code]`
    },
    {
        name: 'youtubeStop',
        threadTitle: 'youtubeStop()',
        content: `Stops and removes all YouTube videos that are playing.

[b]Example:[/b]
[code]youtubeStop(); // Stops all YouTube players[/code]`
    },
    {
        name: 'createObject',
        threadTitle: 'createObject(x, y, objectName, args)',
        content: `Creates a new object of a given name at a position. Optional fourth argument is a [b]map[/b] of initial properties (merged into the new instance immediately—same as defs like [i]par[/i], [i]bullet[/i], etc.).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position for the new object.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position for the new object.[/i]
[b][color=#90ee90]objectName[/color][/b] - [i]The object name from the editor.[/i]
[color=#9acd32]args[/color] - [i]Optional object literal, e.g. [code]{ par: id.id, bullet: { Alpha: 0.5 } }[/code]. Use braces; [code]par: id[/code] alone is not valid syntax. In scripts, [code]id[/code] is the current instance (object); use [code]id.id[/code] for its numeric id.[/i]

[b][color=#ffa500]Returns: the created object or null if it failed.[/color][/b]

[b]Example:[/b]
[code]var enemy = createObject(x, y, "Enemy");
if (enemy) {
    enemy.hp = 300;
}[/code]
[i]Creates an Enemy at (x,y) and sets its hp to 300.[/i]

[code]createObject(90, 160, "emitter", { par: id.id });[/code]
[i]Spawn an emitter whose [code]par[/code] def is set to the caller's numeric id.[/i]

[code]createObject(90, 160, "myObject");
// or createObject(90, 160, "myObject", "ignoredType", { speed: 2 }); // 5-arg form[/code]`
    },
    {
        name: 'typeSet',
        threadTitle: 'typeSet(typename)',
        content: `Switches this object to a different type so that type's code runs starting next frame.

[b]Arguments:[/b]
[b][color=#90ee90]typename[/color][/b] - [i]The name of the type to switch to.[/i]

[b][color=#ffa500]Returns: true if the type was set, false otherwise.[/color][/b]

[b]Example:[/b]
[code]typeSet("myType"); // Apply type "myType" to this object next frame[/code]`
    },
    {
        name: 'makeDraggable',
        threadTitle: 'makeDraggable()',
        content: `Makes this object draggable with the mouse or touch (call every frame to keep it draggable).

[b]Example:[/b]
[code]makeDraggable(); // Makes this object draggable[/code]`
    },
    {
        name: 'winScreen',
        threadTitle: 'winScreen()',
        content: `Shows the stage clear / win screen.

[b]Example:[/b]
[code]if (waveGetCurrent() >= 5)
#winScreen()[/code]`
    },
    {
        name: 'createBullet',
        threadTitle: 'createBullet(x, y, params)',
        content: `Creates a bullet at (x, y). Only [b]x[/b] and [b]y[/b] are arguments. Set Speed, Direction, Size, etc. via optional [b]params[/b] object.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[color=#9acd32]params[/color] - [i]Optional object: { Speed, Direction, Size, Alpha, Color, Homing, ... }. Defaults: Speed 0, Direction 0, Size 4.[/i]

[b][color=#ffa500]Returns: the bullet's unique ID.[/color][/b]

[b]Example:[/b]
[code]createBullet(x, y, { Speed: 5, Direction: 90, Size: 2 });

var id = createBullet(x, y);
inBullet(id)
#Direction = 90
#Speed = 5[/code]`
    },
    {
        name: 'deleteBullet',
        threadTitle: 'deleteBullet(id)',
        content: `Removes a bullet from the game using its ID.

[b]Arguments:[/b]
[b][color=#90ee90]id[/color][/b] - [i]The bullet's ID (from createBullet or inBullet).[/i]

[b][color=#ffa500]Returns:[/color][/b] true if the bullet was removed, false if not found.

[b]Example:[/b]
[code]var bid = createBullet(x, y, { Speed: 5, Direction: 90, Size: 2 });
if interval(60)
#deleteBullet(bid)[/code]
[i]Creates a bullet and removes it after 60 frames.[/i]`
    },
    {
        name: 'surfaceSet',
        threadTitle: 'surfaceSet(surfaceName)',
        content: `Routes subsequent drawing to a named surface (layer). Everything drawn after this call goes to that surface until surfaceReset() or another surfaceSet().

[b]Arguments:[/b]
[b][color=#90ee90]surfaceName[/color][/b] - [i]Layer name (for example "main", "back", "ui", "glow").[/i]

[b]Example:[/b]
[code]surfaceSet("back");
createBullet(x, y, { Speed: 5, Direction: 270, Size: 5 });
drawCircle(x, y, 3);
surfaceReset();
drawSurface("back", 0, 0);[/code]`
    },
    {
        name: 'surfaceReset',
        threadTitle: 'surfaceReset()',
        content: `Switches drawing target back to the main surface (same as surfaceSet("main")).

[b]Example:[/b]
[code]surfaceSet("back");
createBullet(x, y);
surfaceReset();[/code]`
    },
    {
        name: 'drawBlendSet',
        threadTitle: 'drawBlendSet(mode)',
        content: `Sets blend mode for subsequent draw calls on the current surface until changed again.

[b]Modes:[/b]
[color=#90ee90]normal[/color] - [i]Default blending.[/i]
[color=#90ee90]additive[/color] - [i]Adds light (good for glow effects).[/i]
[color=#90ee90]subtract[/color] - [i]Cuts a hole to show layers below.[/i]

[b]Example:[/b]
[code]surfaceSet("top");
drawCircle(50, 50, 20);
drawBlendSet("subtract");
drawCircle(90, 90, 15);  // Hole in top surface
drawBlendReset();[/code]`
    },
    {
        name: 'drawBlendReset',
        threadTitle: 'drawBlendReset()',
        content: `Restores blend mode to normal (same as drawBlendSet("normal")).`
    },
    {
        name: 'drawSetAlpha',
        threadTitle: 'drawSetAlpha(alpha)',
        content: `Sets default alpha (opacity) for later draw calls that do not pass their own alpha.

[b]Arguments:[/b]
[b][color=#90ee90]alpha[/color][/b] - [i]0..1 (0 invisible, 1 fully visible).[/i]

[b]Tip:[/b] Use [color=#ffa500]drawSetAlpha(1)[/color] to reset.`
    },
    {
        name: 'drawSetColor',
        threadTitle: 'drawSetColor(hexCol)',
        content: `Sets default draw color for later draw calls that do not pass a color.

[b]Arguments:[/b]
[b][color=#90ee90]hexCol[/color][/b] - [i]Color value (for example "#ff8080"). Pass null to clear default color.[/i]`
    },
    {
        name: 'drawSetAlign',
        threadTitle: 'drawSetAlign(align)',
        content: `Sets default alignment used by drawSprite, drawBackground, and drawSurface when align is omitted.

[b]Arguments:[/b]
[b][color=#90ee90]align[/color][/b] - [i]1..9 grid (1=top-left, 5=center, 9=bottom-right). Pass null to clear.[/i]`
    },
    {
        name: 'drawDepthSet',
        threadTitle: 'drawDepthSet(depth)',
        content: `Sets default draw depth (z-order) for later draw calls that omit depth.
Lower values draw first (behind); higher values draw later (in front). Use drawDepthReset() to return to 0.

[b]Example:[/b]
[code]drawDepthSet(-20);
drawCircle(x, y, 8);
drawDepthReset();[/code]`
    },
    {
        name: 'drawDepthReset',
        threadTitle: 'drawDepthReset()',
        content: `Resets default draw depth to 0 (same as drawDepthSet(0)).`
    },
    {
        name: 'drawSurface',
        threadTitle: 'drawSurface(surfaceName, x, y, angle, xscale, yscale, alpha, layer, align)',
        content: `Draws a named surface (layer content) at a position. Use this to show non-main surfaces you filled with surfaceSet().

[b]Align grid:[/b] 1=top-left, 2=top-center, 3=top-right, 4=mid-left, 5=center, 6=mid-right, 7=bottom-left, 8=bottom-center, 9=bottom-right.

[b]Arguments:[/b]
[b][color=#90ee90]surfaceName[/color][/b] - [i]The name of the layer to draw.[/i]
[color=#9acd32]x, y[/color] - [i]Optional position (default 0).[/i]
[color=#9acd32]angle[/color] - [i]Optional rotation in degrees (default 0).[/i]
[color=#9acd32]xscale, yscale[/color] - [i]Optional scale (default 1).[/i]
[color=#9acd32]alpha[/color] - [i]Optional opacity from 0 to 1 (default 1).[/i]
[color=#9acd32]layer[/color] - [i]Optional draw order layer (default 0).[/i]
[color=#9acd32]align[/color] - [i]Optional 1–9 for which point (x,y) is (default 7 is bottom-left).[/i]

[b]Example:[/b]
[code]drawSurface("back", 0, 0, 0, 1, 1, 0.5, -10);
drawSurface("front", 90, 160, 45, 1, 1, 1, -1, 5); // center at (90,160)[/code]`
    },
    {
        name: 'shaderSet',
        threadTitle: 'shaderSet(name, ...values)',
        content: `Sets the active shader for subsequent bullet and draw calls.

[b]Use:[/b]
[code]shaderSet("invert");                       // activate built-in shader
shaderSet("ripple", x, y, 2.0, 14.0, 0.03, 0.02); // built-in with params[/code]

[b]Custom shader:[/b]
[code]shaderSet("myFx", vertexSource, fragmentSource); // register/update + activate[/code]

[b]Tip:[/b] Use [color=#ffa500]shaderReset()[/color] to return to default shader.`
    },
    {
        name: 'shaderUniformSet',
        threadTitle: 'shaderUniformSet(name, uniformName, value)',
        content: `Sets one uniform value on a shader.

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]Shader name.[/i]
[b][color=#90ee90]uniformName[/color][/b] - [i]Uniform variable name (for example u_saturation).[/i]
[b][color=#90ee90]value[/color][/b] - [i]Number or vector/list depending on the uniform type.[/i]

[b]Example:[/b]
[code]shaderSet("saturation");
shaderUniformSet("saturation", "u_saturation", 0.25);
drawBackground(0, 0, "bg");
shaderReset();[/code]`
    },
    {
        name: 'shaderReset',
        threadTitle: 'shaderReset()',
        content: `Resets shader back to the default rendering shader.

[b]Example:[/b]
[code]shaderSet("invert");
drawSurface("back", 0, 0);
shaderReset();[/code]`
    },
    {
        name: 'drawAnimated',
        threadTitle: 'drawAnimated(x, y, character, animation, bones, scaleX, scaleY)',
        content: `Shows an animated character at a position and returns a handle so you can control it.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]character[/color][/b] - [i]The character or skeleton asset name.[/i]
[b][color=#90ee90]animation[/color][/b] - [i]The name of the animation to play.[/i]
[color=#9acd32]bones[/color] - [i]Optional list of bone names to hide.[/i]
[color=#9acd32]scaleX[/color] - [i]Optional horizontal scale.[/i]
[color=#9acd32]scaleY[/color] - [i]Optional vertical scale.[/i]

[b][color=#ffa500]Returns: a handle you can use to control the animation.[/color][/b]

[b]Example:[/b]
[code]var animX = 90;
var animY = 160;
var bonesToHide = ["arm_L", "arm_R"];
var handle = drawAnimated(animX, animY, "ForestBee", "Idle", bonesToHide, 2, 2);[/code]`
    },
    {
        name: 'destroy',
        threadTitle: 'destroy(id)',
        content: `Removes an object from the game (or this object if you do not pass an ID).

[b]Arguments:[/b]
[color=#9acd32]id[/color] - [i]Optional. Omit to remove this object. Number or object reference: that instance. String: [b]object name[/b] — removes [b]all[/b] instances of that coded object type, and all instances of [b]child[/b] types (inheritance in the stage editor parent/child map).[/i]

[b][color=#ffa500]Returns: true if at least one instance was marked for removal, false otherwise.[/color][/b]

[b]Example:[/b]
[code]destroy(); // removes self
destroy("Stream"); // every instance of Stream and child object types
destroy(123); // removes codeChild with id 123[/code]`
    },
    {
        name: 'debugMessage',
        threadTitle: 'debugMessage(message)',
        content: `Shows a message in the debug or chat tab.

[b]Arguments:[/b]
[b][color=#90ee90]message[/color][/b] - [i]The message to show.[/i]

[b]Example:[/b]
[code]debugMessage("Player HP: " + playerHp);[/code]`
    },
    {
        name: 'objectOutScreen',
        threadTitle: 'objectOutScreen(x, y, margin)',
        content: `Tells you whether a position is off the visible screen.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position to check.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position to check.[/i]
[color=#9acd32]margin[/color] - [i]Optional extra distance outside the screen to still count as out.[/i]

[b][color=#ffa500]Returns: true if off screen, false otherwise.[/color][/b]

[b]Example:[/b]
[code]if (objectOutScreen(x, y, 0.1)) { dead = true; }[/code]`
    },
    {
        name: 'bulletOutScreen',
        threadTitle: 'bulletOutScreen(i)',
        content: `Default handler used by the engine to remove a bullet that goes off-screen.

[b]Arguments:[/b]
[b][color=#90ee90]i[/color][/b] - [i]Bullet index in the internal bullet buffer.[/i]

[b]Example:[/b]
[code]// Advanced callback usage:
// bulletOutScreen(i)[/code]`
    },
    {
        name: 'colideBullet',
        threadTitle: 'colideBullet(x, y, radius, type)',
        content: `Returns a list of bullet IDs that collided with circle (x,y,radius) this frame. Optional [b]type[/b] (number): if passed, only bullets with that type are returned.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the center.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the center.[/i]
[b][color=#90ee90]radius[/color][/b] - [i]How far to search for bullets.[/i]
[b][color=#90ee90]type[/color][/b] - [i]Optional. Bullet type number; if passed, only bullets with same type.[/i]

[b][color=#ffa500]Returns: a list of bullet IDs, or an empty list if none.[/color][/b]

[b]Example:[/b]
[code]var bids = colideBullet(x, y, 8);
inBullet(bids)
# alpha = 0.2;[/code]`
    },
    {
        name: 'colideOtherObject',
        threadTitle: 'colideOtherObject(x, y, size, object, size2)',
        content: `Checks if a circle at a position touches any other object with a given object name (ignores this object).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the center.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the center.[/i]
[b][color=#90ee90]size[/color][/b] - [i]Collision radius for this object.[/i]
[b][color=#90ee90]object[/color][/b] - [i]Object name to check against (matched against objectName).[/i]
[b][color=#90ee90]size2[/color][/b] - [i]Radius to use for the other objects.[/i]

[b][color=#ffa500]Returns: the first object that is touching, or null.[/color][/b]

[b]Example:[/b]
[code]var other = colideOtherObject(x, y, 8, "enemy", 6);
if (other !== null) { other.hp -= 1; }[/code]`
    },
    {
        name: 'objectNearest',
        threadTitle: 'objectNearest(x, y, objectName)',
        content: `Returns the closest object with the given name to a point (ignores this object).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position to measure from.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position to measure from.[/i]
[b][color=#90ee90]objectName[/color][/b] - [i]The object name to look for (e.g. "enemy").[/i]

[b][color=#ffa500]Returns: the nearest object or null if none.[/color][/b]

[b]Example:[/b]
[code]var target = objectNearest(x, y, "enemy"); if (target) { direction = turnTowards(direction, getDirection(target.x, target.y), 5); }[/code]`
    },
    {
        name: 'objectExists',
        threadTitle: 'objectExists(objectName)',
        content: `Tells you whether at least one object exists with the given name, or with a child type under that object in the parent/child hierarchy (stage editor).

[b]Arguments:[/b]
[b][color=#90ee90]objectName[/color][/b] - [i]Object type name (e.g. "enemy"). Matches instances of that type and any descendant types.[/i]

[b][color=#ffa500]Returns: true if any exist, false otherwise.[/color][/b]

[b]Example:[/b]
[code]if (objectExists("enemy")) { /* spawn boss */ }[/code]`
    },
    {
        name: 'objectCount',
        threadTitle: 'objectCount(objectName)',
        content: `Returns how many objects with the given name exist.

[b]Arguments:[/b]
[b][color=#90ee90]objectName[/color][/b] - [i]The object name to count (e.g. "enemy").[/i]

[b][color=#ffa500]Returns: the count.[/color][/b]

[b]Example:[/b]
[code]var n = objectCount("enemy"); drawText(5, 5, "Enemies: " + n);[/code]`
    },
    {
        name: 'playerNearest',
        threadTitle: 'playerNearest()',
        content: `Returns the closest player to this object (same kind of data as the player variable).

[b][color=#ffa500]Returns: the player object or null if there is no valid player.[/color][/b]

[b]Example:[/b]
[code]var p = playerNearest(); if (p) { direction = turnTowards(direction, getDirection(p.x, p.y), 5); }[/code]`
    },
    {
        name: 'drawBackground',
        threadTitle: 'drawBackground(x, y, backgroundName, layer)',
        content: `Draws a named background created with background(). Static backgrounds reuse cached content; dynamic backgrounds show their latest redraw.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]backgroundName[/color][/b] - [i]The name you gave the background when you created it.[/i]
[color=#9acd32]layer[/color] - [i]Optional compositing layer group with surfaces (>0 behind main, 0 main, <0 front).[/i]

[b]Tip:[/b] For angle/color/align use [color=#ffa500]drawBackgroundExt(x, y, backgroundName, layer, angle, color, align)[/color].

[b]Example:[/b]
[code]drawBackground(90, 160, "myBg") // bottom-left at (90,160)
drawBackground(90, 160, "myBg", 10) // draw in layer 10 (behind main)[/code]`
    },
    {
        name: 'musicPlay',
        threadTitle: 'musicPlay(songName, sequenceIndex, volume)',
        content: `Starts playing a soundtrack from the music folder (name must start with $).

[b]Arguments:[/b]
[b][color=#90ee90]songName[/color][/b] - [i]The song name from the music folder (must start with $).[/i]
[color=#9acd32]sequenceIndex[/color] - [i]Optional starting order or section number.[/i]
[color=#9acd32]volume[/color] - [i]Optional volume from 0 to 1.[/i]

[b]Example:[/b]
[code]musicPlay("$lethal-weapon-level-1.xm");
musicPlay("$song.xm", 2, 0.5);[/code]`
    },
    {
        name: 'musicStop',
        threadTitle: 'musicStop()',
        content: `Stops the music that is currently playing.`
    },
    {
        name: 'musicGetSequence',
        threadTitle: 'musicGetSequence()',
        content: `Tells you which order or section number the current song is on.

[b][color=#ffa500]Returns: the current order/section number.[/color][/b]`
    },
    {
        name: 'musicSetSequence',
        threadTitle: 'musicSetSequence(sequenceIndex)',
        content: `Jumps the current song to a specific order or section and plays from there.

[b]Arguments:[/b]
[b][color=#90ee90]sequenceIndex[/color][/b] - [i]The order or section number to jump to.[/i]
`
    }
];

export const dragonBonesHelp = [
    {
        name: 'Example: basic handle',
        content: `You can change the handle's scale and opacity (e.g. ani.scale = 0.7; ani.alpha = 0.9).`
    },
    {
        name: 'ani.armature.getBone(name)',
        content: `Returns a bone by its name so you can move or hide it; name is the bone name on the skeleton.`
    },
    {
        name: 'bone.visible',
        content: `Set to true to show the bone and its visuals, or false to hide them.`
    },
    {
        name: 'bone.origin',
        content: `The bone's default position and rotation from the skeleton (different from bone.global or bone.offset).`
    },
    {
        name: 'Example: animation',
        content: `The handle lets you set angle and alpha, and the animation has currentTime, isPlaying, and timeScale for playback.`
    },
    {
        name: 'Example: bones',
        content: `When ani.ready is true, get a bone with getBone("arm"), change bone.offset, then call bone.invalidUpdate().`
    }
];

export const javaScriptStuffHelp = [];

export const mathFunctionsHelp = [
    { name: 'abs(x)', content: `Returns the absolute value (removes the minus sign).` },
    { name: 'atan2(y, x)', content: `Returns the angle from the x-axis to the point (x, y).` },
    { name: 'ceil(x)', content: `Rounds up to the next whole number.` },
    { name: 'cos(x)', content: `Returns the cosine of an angle.` },
    { name: 'E', content: `Euler's number (about 2.718).` },
    { name: 'floor(x)', content: `Rounds down to the previous whole number.` },
    { name: 'max(a, b, ...)', content: `Returns the largest of the values.` },
    { name: 'min(a, b, ...)', content: `Returns the smallest of the values.` },
    { name: 'PI', content: `Pi (about 3.14159).` },
    { name: 'pow(x, y)', content: `Returns x raised to the power of y.` },
    { name: 'random()', content: `Returns a random number between 0 and 1.` },
    { name: 'round(x)', content: `Rounds to the nearest whole number.` },
    { name: 'sin(x)', content: `Returns the sine of an angle.` },
    { name: 'sqrt(x)', content: `Returns the square root.` },
    { name: 'tan(x)', content: `Returns the tangent of an angle.` }
];

export const arrayMethodsHelp = [
    { name: 'array.length', content: `Returns how many items are in the list.` },
    { name: 'array.push(item)', content: `Adds an item to the end of the list.` },
    { name: 'array.pop()', content: `Removes and returns the last item.` },
    { name: 'array.shift()', content: `Removes and returns the first item.` },
    { name: 'array.unshift(item)', content: `Adds an item to the start of the list.` },
    { name: 'array.indexOf(item)', content: `Returns the position of the first matching item or -1.` },
    { name: 'array.includes(item)', content: `Returns true if the list contains the item.` },
    { name: 'array.slice(start, end)', content: `Returns a new list from a range of positions.` },
    { name: 'array.splice(i, n, ...)', content: `Removes or inserts items at a position.` },
    { name: 'array.forEach(fn)', content: `Runs a function once for each item.` },
    { name: 'array.map(fn)', content: `Returns a new list by transforming each item.` },
    { name: 'array.filter(fn)', content: `Returns a new list with only items that pass a test.` },
    { name: 'array.find(fn)', content: `Returns the first item that passes a test.` },
    { name: 'array.join(sep)', content: `Joins all items into one string with a separator.` },
    { name: 'listShuffle(arr)', content: `Randomly reorders the list and returns it.` },
    { name: 'listFilterOut(array, value)', content: `Removes every copy of a value from the list.` },
    { name: 'listAdd(array, value)', content: `Adds a value to the end of the list.` },
    { name: 'listFind(array, value)', content: `Returns the first position of a value or -1.` },
    { name: 'listPop(array)', content: `Removes and returns the last item.` },
    { name: 'listRemove(array, value)', content: `Removes every copy of a value from the list.` }
];

export const stringMethodsHelp = [
    { name: 'string.length', content: `Returns how many characters are in the text.` },
    { name: 'string.charAt(i)', content: `Returns the character at a given position.` },
    { name: 'string.indexOf(str)', content: `Returns the position where a piece of text first appears or -1.` },
    { name: 'string.includes(str)', content: `Returns true if the text contains the given piece.` },
    { name: 'string.substring(s, e)', content: `Returns the part of the text between two positions.` },
    { name: 'string.slice(s, e)', content: `Returns the part of the text between two positions.` },
    { name: 'string.split(sep)', content: `Splits the text into a list using a separator.` },
    { name: 'string.toLowerCase()', content: `Returns the text with all letters in lowercase.` },
    { name: 'string.toUpperCase()', content: `Returns the text with all letters in uppercase.` },
    { name: 'string.trim()', content: `Returns the text with spaces removed from the start and end.` },
    { name: 'string.replace(a, b)', content: `Returns the text with one piece replaced by another.` }
];

export const numberMethodsHelp = [
    { name: 'Number.parseInt(str)', content: `Turns a string into a whole number.` },
    { name: 'Number.parseFloat(str)', content: `Turns a string into a decimal number.` },
    { name: 'num.toFixed(n)', content: `Returns the number as text with a fixed number of decimal places.` },
    { name: 'num.toString()', content: `Returns the number as text.` },
    { name: 'isNaN(x)', content: `Returns true if the value is not a valid number.` },
    { name: 'isFinite(x)', content: `Returns true if the value is a normal finite number.` }
];

export const globalFunctionsHelp = [
    { name: 'Object.keys(obj)', content: `Returns a list of the object's property names.` },
    { name: 'Object.values(obj)', content: `Returns a list of the object's property values.` },
    { name: 'Object.assign(target, src)', content: `Copies properties from one object into another.` },
    { name: 'Object.entries(obj)', content: `Returns a list of name-value pairs from the object.` },
    { name: 'Object.hasOwnProperty(key)', content: `Returns true if the object has that property.` },
    { name: 'Date.now()', content: `Returns the current time as a number (milliseconds).` },
    { name: 'new Date()', content: `Creates a date for the current time.` },
    { name: 'new Date(timestamp)', content: `Creates a date from a timestamp number.` },
    { name: 'parseInt(str)', content: `Turns a string into a whole number.` },
    { name: 'parseFloat(str)', content: `Turns a string into a decimal number.` },
    { name: 'isNaN(x)', content: `Returns true if the value is not a valid number.` },
    { name: 'isFinite(x)', content: `Returns true if the value is a normal finite number.` },
    { name: 'encodeURIComponent(str)', content: `Encodes text so it is safe to use in a URL.` },
    { name: 'decodeURIComponent(str)', content: `Decodes text that was encoded for a URL.` },
    { name: 'String(x)', content: `Turns a value into text.` },
    { name: 'Number(x)', content: `Turns a value into a number.` },
    { name: 'Boolean(x)', content: `Turns a value into true or false.` },
    { name: 'Array.isArray(x)', content: `Returns true if the value is a list.` }
];

export const arrayConstructorHelp = [
    { name: 'new Array()', content: `Creates an empty list.` },
    { name: 'new Array(n)', content: `Creates a list with n empty slots.` },
    { name: 'new Array(a, b, c)', content: `Creates a list with the given items.` },
    { name: '[1, 2, 3]', content: `Creates a list using bracket syntax.` },
    { name: 'Array.from(obj)', content: `Creates a list from something that can be looped over.` },
    { name: 'Array.of(...args)', content: `Creates a list from the values you pass in.` }
];

export const stringNumberConstructorsHelp = [
    { name: 'new String(str)', content: `Creates a string from the given value.` },
    { name: '"text" or \'text\'', content: `Text in quotes is a string.` },
    { name: 'template literal', content: `Backticks let you embed values in text.` },
    { name: 'new Number(n)', content: `Creates a number from the given value.` },
    { name: '123 or 12.34', content: `A number written directly is a number literal.` },
    { name: '0x123', content: `A number starting with 0x is in base 16.` }
];