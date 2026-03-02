// server/help-content.js
// Export help content as BBCode for forum initialization

export const specialKeywordsHelp = [
    {
        name: 'background',
        content: `Creates a named scene you can draw once (static) or every frame (dynamic), then show with drawBackground.

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]The name you use when drawing this background with drawBackground.[/i]
[color=#9acd32]dynamic[/color] - [i]Set to true if the background should be redrawn every frame (e.g. for moving parts); leave out or false for a one-time drawn scene.[/i]
[color=#9acd32]width, height[/color] - [i]Optional; for dynamic backgrounds, the size of the drawing area in numbers (e.g. 200, 400).[/i]

[b]Example (static):[/b]
[code]background("bg1")
#drawCircle(90, 160, 4, 0, "#FF0000")
#drawText(50, 100, "Hello", "#FFFFFF", 12)
drawBackground(0, 0, "bg1")[/code]

[b]Example (dynamic):[/b]
[code]background("parallax", true)
#drawSprite(90 + getTime()*10, 160, "@cloud", 1, 1, 0)
drawBackground(0, 0, "parallax")[/code]

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
        content: `Lets you change properties of one or more bullets by their ID.

[b]Arguments:[/b]
[b][color=#90ee90]id[/color][/b] - [i]The bullet or list of bullets you want to change.[/i]

[b]Example:[/b]
[code]var Id = createBullet(x, y, 5, direction, 2)
inBullet(Id)
#Alpha = 0.2[/code]
[i]Sets Alpha for one bullet by its Id.[/i]`
    },
    {
        name: 'repeat',
        content: `Runs a block of code a set number of times (use # to indent the block).

[b]Arguments:[/b]
[b][color=#90ee90]n[/color][/b] - [i]How many times the block should run.[/i]

[b]Example:[/b]
[code]var i = 0
repeat(5)
#createBullet(x,y,5,direction-15*i)
#i++[/code]
[i]Creates 5 bullets in a spread pattern using a counter variable.[/i]`
    },
    {
        name: 'interval',
        threadTitle: 'interval(frames, initTime?)',
        content: `Runs a block every so many frames, with an optional delay before the first run.

[b]Arguments:[/b]
[b][color=#90ee90]frames[/color][/b] - [i]How many frames to wait between each run.[/i]
[color=#9acd32]initTime[/color] - [i]Optional; the first run happens after this many frames, then every frames after that.[/i]

[b]Example:[/b]
[code]if interval(20)
#if x > 20
##hp++
if interval(10, 4)
#createBullet(x, y, 2, 0, 1)[/code]
[i]First block every 20 frames. Second: first fire in 4 frames, then every 10.[/i]`
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
        content: `List of all bullets on screen; use inBullet() to change them, and the game removes bullets when they hit or leave the play area.

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
        name: 'Id',
        content: `This object's unique ID.`
    },
    {
        name: 'myBullets',
        content: `The list of bullets this object created; use it with inBullet to change only those bullets (and reference myBullets at least once so the list is kept).

[b]Use:[/b]
[code]inBullet(myBullets)
#Alpha = 0.5[/code]
[i]Affects only bullets created by this object.[/i]

[b]Count:[/b] Use [color=#ffa500]myBullets.size[/color] (Set has .size, not .length).

[b]Example:[/b]
[code]createBullet(x, y, 5, direction, 2)
inBullet(myBullets)
#Speed = 3
if (myBullets.size > 10)
#deleteBullet(Id)[/code]`
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
        threadTitle: 'getDirection(x, y)',
        content: `Gives the angle in degrees from this object's position to a target point.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]The target's horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]The target's vertical position.[/i]

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
        threadTitle: 'normalizeAngle(angle)',
        content: `Puts an angle into the 0–360 range (e.g. -90 becomes 270, 450 becomes 90).

[b]Arguments:[/b]
[b][color=#90ee90]angle[/color][/b] - [i]The angle in degrees to normalize.[/i]

[b][color=#ffa500]Returns:[/color][/b] the angle as a number between 0 and 360.
[b]Example:[/b]
[code]direction = normalizeAngle(450); // returns 90[/code]`
    },
    {
        name: 'angleDifference',
        threadTitle: 'angleDifference(a, b)',
        content: `Gives the shortest angle between two directions in degrees.

[b]Arguments:[/b]
[b][color=#90ee90]a[/color][/b] - [i]The first angle in degrees.[/i]
[b][color=#90ee90]b[/color][/b] - [i]The second angle in degrees.[/i]

[b][color=#ffa500]Returns: the angle difference (can be negative).[/color][/b]

[b]Example:[/b]
[code]var diff = angleDifference(0, 270); // returns -90[/code]`
    },
    {
        name: 'getDistance',
        threadTitle: 'getDistance(x, y)',
        content: `Gives the distance from this object to a target point.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]The target's horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]The target's vertical position.[/i]

[b][color=#ffa500]Returns: the distance.[/color][/b]

[b]Example:[/b]
[code]var dist = getDistance(100, 200);[/code]`
    },
    {
        name: 'lenDirX',
        threadTitle: 'lenDirX(len, dir)',
        content: `Gives the horizontal part of a distance in a given direction.

[b]Arguments:[/b]
[b][color=#90ee90]len[/color][/b] - [i]The distance or length.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]The direction in degrees.[/i]

[b][color=#ffa500]Returns: the horizontal offset.[/color][/b]

[b]Example:[/b]
[code]var offsetX = lenDirX(10, 90); // returns 0 (straight up)[/code]`
    },
    {
        name: 'lenDirY',
        threadTitle: 'lenDirY(len, dir)',
        content: `Gives the vertical part of a distance in a given direction.

[b]Arguments:[/b]
[b][color=#90ee90]len[/color][/b] - [i]The distance or length.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]The direction in degrees.[/i]

[b][color=#ffa500]Returns: the vertical offset.[/color][/b]

[b]Example:[/b]
[code]var offsetY = lenDirY(10, 90); // returns 10 (straight up)[/code]`
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
        threadTitle: 'move(len, dir)',
        content: `Moves this object a given distance in a given direction and updates its position.

[b]Arguments:[/b]
[b][color=#90ee90]len[/color][/b] - [i]How far to move.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]The direction in degrees.[/i]

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
        name: 'waveStart',
        threadTitle: 'waveStart(id)',
        content: `Starts the wave with the given number from the stage editor.

[b]Arguments:[/b]
[b][color=#90ee90]id[/color][/b] - [i]The wave number from the stage editor.[/i]

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
        name: 'waveStartNext',
        threadTitle: 'waveStartNext()',
        content: `Switches to the next wave in the stage editor.

[b][color=#ffa500]Returns: true if it switched, false otherwise.[/color][/b]

[b]Example:[/b]
[code]waveStartNext();[/code]`
    },
    {
        name: 'drawCircle',
        threadTitle: 'drawCircle(x, y, r, outline, color)',
        content: `Draws a circle at a position with optional outline thickness and color.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the center.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the center.[/i]
[b][color=#90ee90]r[/color][/b] - [i]The radius (size) of the circle.[/i]
[color=#9acd32]outline[/color] - [i]Optional; use 0 for filled, or a number for outline thickness.[/i]
[color=#9acd32]color[/color] - [i]Optional color (e.g. "#ff0000" for red).[/i]

[b]Example:[/b]
[code]drawCircle(100, 200, 5); // filled white circle
// or drawCircle(100, 200, 5, 1); // outline with width 1
// or drawCircle(100, 200, 5, 0, "#ff0000"); // red filled circle[/code]`
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
        content: `Draws a grid of tiles; use three arguments for the whole world or seven for a specific area.

[b]Arguments (full world):[/b]
[color=#9acd32]cellW[/color] - [i]Optional width of each tile.[/i]
[color=#9acd32]cellH[/color] - [i]Optional height of each tile.[/i]
[color=#9acd32]color[/color] - [i]Optional color.[/i]

[b]Arguments (region):[/b] [color=#90ee90]x, y, w, h[/color] - [i]Left, bottom, width, and height of the area, then cell size and color.[/i]

[b]Example:[/b]
[code]drawGround(10, 10, "#003E29"); // full world, 10x10 cells
drawGround(0, 0, 90, 160, 4, 4, "#ff0000"); // red grid in left half[/code]`
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
        threadTitle: 'soundPlay(sound, volume, pitch)',
        content: `Plays a sound from the sound effects folder (use the name without the file extension).

[b]Arguments:[/b]
[b][color=#90ee90]sound[/color][/b] - [i]The sound name from the sound effects folder.[/i]
[color=#9acd32]volume[/color] - [i]Optional volume from 0 to 1 (default 1).[/i]
[color=#9acd32]pitch[/color] - [i]Optional pitch (1 is normal).[/i]

[b]Example:[/b]
[code]soundPlay("explosion", 1.0, 1.0);
// or soundPlay("explosion"); // uses default volume and pitch[/code]`
    },
    {
        name: 'drawSprite',
        threadTitle: 'drawSprite(x, y, name, scaleX, scaleY, rotation, color, align)',
        content: `Draws an image at a position with optional size, rotation, color tint, and which point of the image is at (x,y).

[b]Align grid:[/b] 1=top-left, 2=top-center, 3=top-right, 4=mid-left, 5=center, 6=mid-right, 7=bottom-left, 8=bottom-center, 9=bottom-right.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the anchor point.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the anchor point.[/i]
[b][color=#90ee90]name[/color][/b] - [i]The image name (must start with @).[/i]
[b][color=#90ee90]scaleX[/color][/b] - [i]Horizontal scale (1 is normal size).[/i]
[b][color=#90ee90]scaleY[/color][/b] - [i]Vertical scale (1 is normal size).[/i]
[color=#9acd32]rotation[/color] - [i]Optional rotation in degrees.[/i]
[color=#9acd32]color[/color] - [i]Optional color tint.[/i]
[color=#9acd32]align[/color] - [i]Optional 1–9 for which point of the image is at (x,y); default 5 is center.[/i]

[b]Example:[/b]
[code]drawSprite(90, 160, "@sprite", 1, 1, 45); // center at (90,160), 45° rotation
drawSprite(0, 321, "@ui", 1, 1, 0, null, 1); // top-left at (0,321)[/code]`
    },
    {
        name: 'drawSheetSprite',
        threadTitle: 'drawSheetSprite(x, y, name, frame, maxCellsX, maxCellsY)',
        content: `Draws one frame from an image that contains multiple frames in a grid.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]name[/color][/b] - [i]The sheet image name (must start with @).[/i]
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
        threadTitle: 'createObject(x, y, name, type)',
        content: `Creates a new object of a given name at a position, with an optional type to run on creation.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position for the new object.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position for the new object.[/i]
[b][color=#90ee90]name[/color][/b] - [i]The object name from the editor.[/i]
[color=#9acd32]type[/color] - [i]Optional type to run when the object is created.[/i]

[b][color=#ffa500]Returns: the created object or null if it failed.[/color][/b]

[b]Example:[/b]
[code]createObject(90, 160, "myObject");
// or createObject(90, 160, "myObject", "myType"); // with type[/code]`
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
        name: 'createBullet',
        threadTitle: 'createBullet(x, y, speed, dir, size, ...)',
        content: `Creates a bullet at a position with the given speed, direction, and size (and optional extra properties).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]speed[/color][/b] - [i]How fast the bullet moves.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]Direction in degrees.[/i]
[b][color=#90ee90]size[/color][/b] - [i]How big the bullet is.[/i]
[color=#9acd32]...[/color] - [i]Optional: color, opacity, scale, rotation, lifetime, homing, spin, shape, glow.[/i]

[b][color=#ffa500]Returns: the bullet's unique ID.[/color][/b]

[b]Example:[/b]
[code]var bulletId = createBullet(x, y, 5, 90, 2, [255, 0, 0], 1, 1.0, 0, 2.0, 0.3);[/code]`
    },
    {
        name: 'deleteBullet',
        threadTitle: 'deleteBullet(id)',
        content: `Removes a bullet from the game using its ID.

[b]Arguments:[/b]
[b][color=#90ee90]id[/color][/b] - [i]The bullet's ID (from createBullet or inBullet).[/i]

[b][color=#ffa500]Returns:[/color][/b] true if the bullet was removed, false if not found.

[b]Example:[/b]
[code]var bid = createBullet(x, y, 5, 90, 2);
if interval(60)
#deleteBullet(bid)[/code]
[i]Creates a bullet and removes it after 60 frames.[/i]`
    },
    {
        name: 'surfaceSet',
        threadTitle: 'surfaceSet(surfaceName)',
        content: `Switches drawing to a named layer so bullets and shapes go there until you reset (other layers only show when you draw them with drawSurface).

[b]Arguments:[/b]
[b][color=#90ee90]surfaceName[/color][/b] - [i]The name of the layer (e.g. "main" or "test").[/i]

[b]Example:[/b]
[code]surfaceSet("test");
createBullet(x, y, 5, 270, 5);
drawCircle(x, y, 3);
surfaceReset();
createBullet(x, y, 3, 0, 2);[/code]`
    },
    {
        name: 'surfaceReset',
        threadTitle: 'surfaceReset()',
        content: `Switches drawing back to the main layer (same as surfaceSet("main")).

[b]Example:[/b]
[code]surfaceSet("back");
createBullet(x, y, 3, 0, 2);
surfaceReset();[/code]`
    },
    {
        name: 'drawBlendSet',
        threadTitle: 'drawBlendSet(mode)',
        content: `Changes how new drawings combine with what is already on screen (normal, additive for glow, or subtract for cutouts); use drawBlendReset() to go back to normal.

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
        content: `Restores normal blending (same as drawBlendSet("normal")).`
    },
    {
        name: 'drawSetAlpha',
        threadTitle: 'drawSetAlpha(alpha)',
        content: `Sets the default see-through amount (0 to 1) for later draw calls that do not specify it; use drawSetAlpha(1) to reset.`
    },
    {
        name: 'drawSetColor',
        threadTitle: 'drawSetColor(color)',
        content: `Sets the default color for later draw calls that do not pass a color (e.g. "#ff8080"); pass null to clear it.`
    },
    {
        name: 'drawSetAlign',
        threadTitle: 'drawSetAlign(align)',
        content: `Sets the default anchor point (1–9, e.g. 1=top-left, 5=center, 9=bottom-right) for later drawSprite, drawBackground, and drawSurface; pass null to clear.`
    },
    {
        name: 'drawSurface',
        threadTitle: 'drawSurface(surfaceName, x, y, angle, xscale, yscale, alpha, depth, align)',
        content: `Draws a named layer (its bullets, shapes, and images) at a position with optional scale, rotation, opacity, and draw order; layers other than main only show when you call this.

[b]Align grid:[/b] 1=top-left, 2=top-center, 3=top-right, 4=mid-left, 5=center, 6=mid-right, 7=bottom-left, 8=bottom-center, 9=bottom-right.

[b]Arguments:[/b]
[b][color=#90ee90]surfaceName[/color][/b] - [i]The name of the layer to draw.[/i]
[color=#9acd32]x, y[/color] - [i]Optional position of the anchor point (default 0).[/i]
[color=#9acd32]angle[/color] - [i]Optional rotation in degrees (default 0).[/i]
[color=#9acd32]xscale, yscale[/color] - [i]Optional scale (default 1).[/i]
[color=#9acd32]alpha[/color] - [i]Optional opacity from 0 to 1 (default 1).[/i]
[color=#9acd32]depth[/color] - [i]Optional draw order (default 0).[/i]
[color=#9acd32]align[/color] - [i]Optional 1–9 for which point (x,y) is (default 7 is bottom-left).[/i]

[b]Example:[/b]
[code]drawSurface("back", 0, 0, 0, 1, 1, 0.5, -10);
drawSurface("front", 90, 160, 45, 1, 1, 1, -1, 5); // center at (90,160)[/code]`
    },
    {
        name: 'drawAnimated',
        threadTitle: 'drawAnimated(x, y, name, anim, bones, scaleX, scaleY)',
        content: `Shows an animated character at a position and returns a handle so you can control it.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position.[/i]
[b][color=#90ee90]name[/color][/b] - [i]The character or skeleton asset name.[/i]
[b][color=#90ee90]anim[/color][/b] - [i]The name of the animation to play.[/i]
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
[color=#9acd32]id[/color] - [i]Optional ID of the object to remove; leave out to remove this object.[/i]

[b][color=#ffa500]Returns: true if it was removed, false otherwise.[/color][/b]

[b]Example:[/b]
[code]destroy(); // removes self
// or destroy(123); // removes codeChild with id 123[/code]`
    },
    {
        name: 'debugMessage',
        threadTitle: 'debugMessage(msg)',
        content: `Shows a message in the debug or chat tab.

[b]Arguments:[/b]
[b][color=#90ee90]msg[/color][/b] - [i]The message to show.[/i]

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
        name: 'collidePlayerBullet',
        threadTitle: 'collidePlayerBullet(x, y, radius)',
        content: `Returns a list of player bullet IDs that are within a given distance of a point this frame.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the center.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the center.[/i]
[b][color=#90ee90]radius[/color][/b] - [i]How far to search for bullets.[/i]

[b][color=#ffa500]Returns: a list of bullet IDs, or an empty list if none.[/color][/b]

[b]Example:[/b]
[code]var bids = collidePlayerBullet(x, y, 8);
inBullet(bids)
# alpha = 0.2;[/code]`
    },
    {
        name: 'colideOtherObject',
        threadTitle: 'colideOtherObject(x, y, radius, tag, size)',
        content: `Checks if a circle at a position touches any other object with a given tag (ignores this object).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the center.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the center.[/i]
[b][color=#90ee90]radius[/color][/b] - [i]Collision radius for this object.[/i]
[b][color=#90ee90]tag[/color][/b] - [i]Only objects with this tag are checked.[/i]
[b][color=#90ee90]size[/color][/b] - [i]Radius to use for the other objects.[/i]

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
        content: `Tells you whether at least one object with the given name exists.

[b]Arguments:[/b]
[b][color=#90ee90]objectName[/color][/b] - [i]The object name to look for (e.g. "enemy").[/i]

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
        name: 'background',
        threadTitle: 'background(name, dynamic, width, height)',
        content: `Creates a named scene you draw once (static) or every frame (dynamic), then show with drawBackground; optional width and height set the drawing area size for dynamic backgrounds.

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]The name you use when drawing this background with drawBackground.[/i]
[color=#9acd32]dynamic[/color] - [i]Optional; set true for redraw every frame, or omit/false for one-time.[/i]
[color=#9acd32]width, height[/color] - [i]Optional; for dynamic backgrounds, the drawing area size in numbers.[/i]

[b]Example (static):[/b]
[code]background("bg1")
#drawCircle(90, 160, 4)
drawBackground(0, 0, "bg1")[/code]

[b]Example (dynamic):[/b]
[code]background("parallax", true)
#drawSprite(90 + getTime()*10, 160, "@cloud", 1, 1, 0)
drawBackground(0, 0, "parallax")[/code]

[b]Example (dynamic with size):[/b]
[code]background("ui", true, 200, 400)
#drawRectangle(0, 0, 200, 400, "#112233")
drawBackground(90, 160, "ui", 0, null, 5)[/code]`
    },
    {
        name: 'drawBackground',
        threadTitle: 'drawBackground(x, y, backgroundName, angle, color, align)',
        content: `Draws a background you created with background() at a position with optional rotation, color tint, and anchor point (1–9, default 7 is bottom-left).

[b]Align grid:[/b] 1=top-left, 2=top-center, 3=top-right, 4=mid-left, 5=center, 6=mid-right, 7=bottom-left, 8=bottom-center, 9=bottom-right.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Horizontal position of the anchor point.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Vertical position of the anchor point.[/i]
[b][color=#90ee90]backgroundName[/color][/b] - [i]The name you gave the background when you created it.[/i]
[color=#9acd32]angle[/color] - [i]Optional rotation in degrees.[/i]
[color=#9acd32]color[/color] - [i]Optional color tint.[/i]
[color=#9acd32]align[/color] - [i]Optional 1–9 for which point of the background is at (x,y); default 7.[/i]

[b]Example:[/b]
[code]drawBackground(90, 160, "myBg") // bottom-left at (90,160)
drawBackground(90, 160, "myBg", 0, null, 5) // center at (90,160)[/code]`
    },
    {
        name: 'musicPlay',
        threadTitle: 'musicPlay(name, seq, vol)',
        content: `Starts playing a soundtrack from the music folder (name must start with $).

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]The song name from the music folder (must start with $).[/i]
[color=#9acd32]seq[/color] - [i]Optional starting order or section number.[/i]
[color=#9acd32]vol[/color] - [i]Optional volume from 0 to 1.[/i]

[b]Example:[/b]
[code]musicPlay("$lethal-weapon-level-1");
musicPlay("$song", 2, 0.5);[/code]`
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
        threadTitle: 'musicSetSequence(seq)',
        content: `Jumps the current song to a specific order or section and plays from there.

[b]Arguments:[/b]
[b][color=#90ee90]seq[/color][/b] - [i]The order or section number to jump to.[/i]
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

export const javaScriptStuffHelp = [
    // Keywords are now handled in a separate "Keywords" subcategory under "JavaScript Stuff"
];

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