// server/help-content.js
// Export help content as BBCode for forum initialization

export const specialKeywordsHelp = [
    {
        name: 'background',
        content: `Bakes all draws into a vertex buffer stored under the name given as argument. Use drawBackground(x, y, "name") to draw it. Runs once at compilation.

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]Buffer name to store draws under. Use with drawBackground(x, y, "name").[/i]

[b]Example:[/b]
[code]background("bg1")
#drawCircle(90, 160, 4, 0, "#FF0000")
#drawText(50, 100, "Hello", "#FFFFFF", 12)

// Later in code:
drawBackground(0, 0, "bg1")[/code]
[i]Creates a background with a red circle and white text, then draws it at position (0, 0).[/i]`
    },
    {
        name: 'def',
        content: `Defines a variable with an initial value. The variable persists across frames.

[b]Example:[/b]
[code]def myVar = 10;
def myString = "hello";[/code]
[i]Defines two variables that persist across frames.[/i]`
    },
    {
        name: 'globalvar',
        content: `Define a global variable with initial value. Initialized only once, shared across ALL codeChildren (all objects).

[b]Example:[/b]
[code]globalvar score = 0;

// In any object:
score += 1;[/code]
[i]Creates a shared score counter accessible from every object.[/i]`
    },
    {
        name: 'inBullet',
        threadTitle: 'inBullet(id)',
        content: `Lets you change bullet parameters. Accepts a single bullet ID or an array of IDs.

[b]Arguments:[/b]
[b][color=#90ee90]id[/color][/b] - [i]Bullet ID or array of bullet IDs to modify.[/i]

[b]Example:[/b]
[code]var Id = createBullet(x, y, 5, direction, 2)
inBullet(Id)
#Alpha = 0.2[/code]
[i]Sets Alpha for one bullet by its Id.[/i]`
    },
    {
        name: 'repeat',
        content: `Repeats a block of code n times. Use indentation (#) to define the block.

[b]Arguments:[/b]
[b][color=#90ee90]n[/color][/b] - [i]Number of times to repeat the block.[/i]

[b]Example:[/b]
[code]var i = 0
repeat(5)
#createBullet(x,y,5,direction-15*i)
#i++[/code]
[i]Creates 5 bullets in a spread pattern using a counter variable.[/i]`
    }
];

export const builtInVariablesHelp = [
    {
        name: 'player',
        content: `Player object. 
[b]Properties:[/b] [color=#ffa500]x[/color], [color=#ffa500]y[/color], [color=#ffa500]hp[/color], [color=#ffa500]knockbackTime[/color], [color=#ffa500]knockbackPower[/color], [color=#ffa500]knockbackDirection[/color]`
    },
    {
        name: 'bulletData',
        content: `Array of all existing bullets and their parameters. Use inBullet() to iterate.
[b]Properties:[/b] [color=#ffa500]Id[/color], [color=#ffa500]X[/color], [color=#ffa500]Y[/color], [color=#ffa500]R[/color], [color=#ffa500]G[/color], [color=#ffa500]B[/color], [color=#ffa500]Alpha[/color], [color=#ffa500]Size[/color], [color=#ffa500]ScaleY[/color], [color=#ffa500]Rotation[/color], [color=#ffa500]Lifetime[/color], [color=#ffa500]Homing[/color], [color=#ffa500]Spin[/color], [color=#ffa500]Shape[/color], [color=#ffa500]GlowSize[/color], [color=#ffa500]GlowPower[/color], [color=#ffa500]GlowR[/color], [color=#ffa500]GlowG[/color], [color=#ffa500]GlowB[/color]`
    },
    {
        name: 'bulletCount',
        content: `Number of active bullets`
    },
    {
        name: 'tapX',
        content: `Mouse/tap x position in world coordinates`
    },
    {
        name: 'tapY',
        content: `Mouse/tap y position in world coordinates`
    },
    {
        name: 'x',
        content: `x position of the current object`
    },
    {
        name: 'y',
        content: `y position of the current object`
    },
    {
        name: 'speed',
        content: `Speed of the current object`
    },
    {
        name: 'direction',
        content: `Direction in degrees of the current object`
    },
    {
        name: 'Id',
        content: `Unique ID of this codeChild`
    }
];

export const danmakuHelpersHelp = [
    {
        name: 'getSelf',
        threadTitle: 'getSelf()',
        content: `Gives a reference to the current running object (codeChild). This is NOT a copy. You can read/write properties on it (e.g. getSelf().x = 0).

[b][color=#ffa500]Returns: a reference to the current running object.[/color][/b]

[b]Example:[/b]
[code]var self = getSelf();
self.x = 0;
self.speed = 2;[/code]`
    },
    {
        name: 'getDirection',
        threadTitle: 'getDirection(x, y)',
        content: `Calculates the direction angle in degrees from current position to target point.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Target x position in world coordinates.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Target y position in world coordinates.[/i]

[b][color=#ffa500]Returns: the angle in degrees (0-360).[/color][/b]

[b]Example:[/b]
[code]var dir = getDirection(100, 200);[/code]`
    },
    {
        name: 'normalizeAngle',
        threadTitle: 'normalizeAngle(angle)',
        content: `Normalizes numbers like -90 or 450 to 0-360 direction.

[b]Arguments:[/b]
[b][color=#90ee90]angle[/color][/b] - [i]Angle in degrees to normalize to 0-360.[/i]

[b][color=#ffa500]Returns:[/color][/b] the normalized angle as a number.
[b]Example:[/b]
[code]direction = normalizeAngle(450); // returns 90[/code]`
    },
    {
        name: 'angleDifference',
        threadTitle: 'angleDifference(a, b)',
        content: `Calculates the shortest angle difference between two angles in degrees.

[b]Arguments:[/b]
[b][color=#90ee90]a[/color][/b] - [i]First angle in degrees.[/i]
[b][color=#90ee90]b[/color][/b] - [i]Second angle in degrees.[/i]

[b][color=#ffa500]Returns: the angle difference as a number (can be negative).[/color][/b]

[b]Example:[/b]
[code]var diff = angleDifference(0, 270); // returns -90[/code]`
    },
    {
        name: 'getDistance',
        threadTitle: 'getDistance(x, y)',
        content: `Calculates the distance from current position to target point.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Target x position in world coordinates.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Target y position in world coordinates.[/i]

[b][color=#ffa500]Returns: the distance as a number.[/color][/b]

[b]Example:[/b]
[code]var dist = getDistance(100, 200);[/code]`
    },
    {
        name: 'lenDirX',
        threadTitle: 'lenDirX(len, dir)',
        content: `Converts length and direction (angle in degrees) to x component.

[b]Arguments:[/b]
[b][color=#90ee90]len[/color][/b] - [i]Length/distance.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]Direction angle in degrees.[/i]

[b][color=#ffa500]Returns: the x component as a number.[/color][/b]

[b]Example:[/b]
[code]var offsetX = lenDirX(10, 90); // returns 0 (straight up)[/code]`
    },
    {
        name: 'lenDirY',
        threadTitle: 'lenDirY(len, dir)',
        content: `Converts length and direction (angle in degrees) to y component.

[b]Arguments:[/b]
[b][color=#90ee90]len[/color][/b] - [i]Length/distance.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]Direction angle in degrees.[/i]

[b][color=#ffa500]Returns: the y component as a number.[/color][/b]

[b]Example:[/b]
[code]var offsetY = lenDirY(10, 90); // returns 10 (straight up)[/code]`
    },
    {
        name: 'move',
        threadTitle: 'move(len, dir)',
        content: `Moves the instance by the given length in the given direction (angle in degrees). Modifies x and y positions directly.

[b]Arguments:[/b]
[b][color=#90ee90]len[/color][/b] - [i]Distance to move in pixels.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]Direction angle in degrees.[/i]

[b]Example:[/b]
[code]move(5, 90); // moves 5 pixels upward
move(10, 0); // moves 10 pixels to the right[/code]`
    },
    {
        name: 'isUndef',
        threadTitle: 'isUndef(v)',
        content: `Checks if a variable is undefined or not declared.

[b]Arguments:[/b]
[b][color=#90ee90]v[/color][/b] - [i]Variable or expression to check.[/i]

[b][color=#ffa500]Returns:[/color][/b] true if undefined, false otherwise.
[b]Example:[/b]
[code]if (isUndef(myVar)) { /* variable is undefined or not declared */ }[/code]`
    },
    {
        name: 'rand',
        threadTitle: 'rand(min, max)',
        content: `Generates a random number between min and max.

[b]Arguments:[/b]
[b][color=#90ee90]min[/color][/b] - [i]Minimum value (inclusive).[/i]
[b][color=#90ee90]max[/color][/b] - [i]Maximum value (inclusive).[/i]

[b][color=#ffa500]Returns: a random number.[/color][/b]

[b]Example:[/b]
[code]var value = rand(-100, 100); // random number between -100 and 100[/code]`
    },
    {
        name: 'isEnemy',
        threadTitle: 'isEnemy()',
        content: `Marks the current object as an enemy. When called, the object will have isEnemy=true and will be added to the global enemyList.

[b]Example:[/b]
[code]isEnemy(); // mark this object as an enemy[/code]`
    },
    {
        name: 'enemyList',
        threadTitle: 'enemyList()',
        content: `Provides a global array of all active objects marked as enemies.

[b][color=#ffa500]Returns: a global array of all active objects marked as enemies.[/color][/b]

[b]Example:[/b]
[code]var enemies = enemyList();
for(var i=0; i<enemies.length; i++) {
  var e = enemies[i];
  // do something with enemy
}[/code]`
    },
    {
        name: 'init',
        content: `Use to run code only once when the instance is created.

[b][color=#ffa500]Returns: true on instance create and stays false forever.[/color][/b]

[b]Example:[/b]
[code]if (init()) { /* danmakuINIT is undefined */ }[/code]`
    },
    {
        name: 'turnTowards',
        threadTitle: 'turnTowards(target, maxTurn)',
        content: `Gradually turns the current direction towards target direction, limited by maxTurn degrees per frame.

[b]Arguments:[/b]
[b][color=#90ee90]target[/color][/b] - [i]Target direction angle in degrees.[/i]
[b][color=#90ee90]maxTurn[/color][/b] - [i]Maximum degrees to turn per frame.[/i]

[b][color=#ffa500]Returns: true if speed is greater than 0, false otherwise.[/color][/b]

[b]Example:[/b]
[code]turnTowards(90, 5); // turns up to 5 degrees towards 90[/code]`
    },
    {
        name: 'turnTowardsPlayer',
        threadTitle: 'turnTowardsPlayer(maxTurn)',
        content: `Gradually turns the current direction towards the player, limited by maxTurn degrees per frame.

[b]Arguments:[/b]
[b][color=#90ee90]maxTurn[/color][/b] - [i]Maximum degrees to turn per frame.[/i]

[b][color=#ffa500]Returns: true if player exists and speed is greater than 0, false otherwise.[/color][/b]

[b]Example:[/b]
[code]turnTowardsPlayer(3);[/code]`
    },
    {
        name: 'waveStart',
        threadTitle: 'waveStart(id)',
        content: `Selects a wave by its id/number (stage editor waves).

[b]Arguments:[/b]
[b][color=#90ee90]id[/color][/b] - [i]Wave id/number from the stage editor.[/i]

[b][color=#ffa500]Returns: true if the wave exists and was selected, false otherwise.[/color][/b]

[b]Example:[/b]
[code]waveStart(1); // select Wave 1
waveStart(2); // select Wave 2[/code]`
    },
    {
        name: 'waveGetCurrent',
        threadTitle: 'waveGetCurrent()',
        content: `Gets the current wave number (stage editor wave id).

[b][color=#ffa500]Returns: the current wave number.[/color][/b]

[b]Example:[/b]
[code]var w = waveGetCurrent();
drawText(5, 5, "Wave: " + w);[/code]`
    },
    {
        name: 'waveStartNext',
        threadTitle: 'waveStartNext()',
        content: `Selects the next wave in the stage editor.

[b][color=#ffa500]Returns: true if it switched to the next wave, false otherwise.[/color][/b]

[b]Example:[/b]
[code]waveStartNext();[/code]`
    },
    {
        name: 'drawCircle',
        threadTitle: 'drawCircle(x, y, r, outline, color)',
        content: `Draws a circle at specified position with optional outline and color.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position (center).[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position (center).[/i]
[b][color=#90ee90]r[/color][/b] - [i]Radius.[/i]
[color=#9acd32]outline[/color] - [i]Outline width (0 = filled). Optional.[/i]
[color=#9acd32]color[/color] - [i]Hex color (e.g. "#ff0000") or RGBA array. Optional.[/i]

[b]Example:[/b]
[code]drawCircle(100, 200, 5); // filled white circle
// or drawCircle(100, 200, 5, 1); // outline with width 1
// or drawCircle(100, 200, 5, 0, "#ff0000"); // red filled circle[/code]`
    },
    {
        name: 'drawRectangle',
        threadTitle: 'drawRectangle(x, y, w, h, color)',
        content: `Draws a rectangle at specified position with optional color. x, y: bottom-left corner position. w, h: width and height.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Bottom-left corner x.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Bottom-left corner y.[/i]
[b][color=#90ee90]w[/color][/b] - [i]Width.[/i]
[b][color=#90ee90]h[/color][/b] - [i]Height.[/i]
[color=#9acd32]color[/color] - [i]Hex color or RGBA array. Optional.[/i]

[b]Example:[/b]
[code]drawRectangle(10, 20, 50, 30); // white rectangle
// or drawRectangle(10, 20, 50, 30, "#ff0000"); // red rectangle
// or drawRectangle(10, 20, 50, 30, [1.0, 0.0, 0.0, 0.5]); // red rectangle with 50% opacity[/code]`
    },
    {
        name: 'drawGround',
        threadTitle: 'drawGround(cellW, cellH, color)',
        content: `Draws a grid of rectangles covering the whole world. cellWidth and cellHeight are the dimensions of each grid cell.

[b]Arguments:[/b]
[color=#9acd32]cellW[/color] - [i]Width of each grid cell. Optional.[/i]
[color=#9acd32]cellH[/color] - [i]Height of each grid cell. Optional.[/i]
[color=#9acd32]color[/color] - [i]Hex color or RGBA array. Optional.[/i]

[b]Example:[/b]
[code]drawGround(10, 10, [1.0, 0.0, 0.0, 1.0]); // red grid with 10x10 cells
// or drawGround(5, 5, "#0000ff"); // blue grid with 5x5 cells
// or drawGround(); // default white grid with 10x10 cells[/code]`
    },
    {
        name: 'drawLight',
        threadTitle: 'drawLight(x, y, radius, power)',
        content: `Adds a light source that makes ground squares lighter based on distance. Closer squares become lighter. x and y are the light position. radius is the effect radius (optional, default: 50). power is the light intensity 0-1 (optional, default: 1.0).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Light x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Light y position.[/i]
[color=#9acd32]radius[/color] - [i]Effect radius. Optional, default 50.[/i]
[color=#9acd32]power[/color] - [i]Light intensity 0-1. Optional, default 1.0.[/i]

[b]Example:[/b]
[code]drawLight(90, 160, 50, 1.0); // bright light at center
// or drawLight(x, y, 30, 0.5); // dimmer light with smaller radius[/code]`
    },
    {
        name: 'clearLights',
        threadTitle: 'clearLights()',
        content: `Clears all light sources. Call at the start of each frame to reset lighting.

[b]Example:[/b]
[code]clearLights(); // remove all lights[/code]`
    },
    {
        name: 'didTapped',
        threadTitle: 'didTapped()',
        content: `Checks if screen was just touched.

[b][color=#ffa500]Returns: true if tapped this frame, false otherwise.[/color][/b]

[b]Example:[/b]
[code]if (didTapped()) { /* handle tap */ }[/code]`
    },
    {
        name: 'didReleased',
        threadTitle: 'didReleased()',
        content: `Checks if touch on screen was just released.

[b][color=#ffa500]Returns: true if released this frame, false otherwise.[/color][/b]

[b]Example:[/b]
[code]if (didReleased()) { /* handle release */ }[/code]`
    },
    {
        name: 'drawText',
        threadTitle: 'drawText(x, y, text, color, size)',
        content: `Draws text at specified position with optional color and size.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position.[/i]
[b][color=#90ee90]text[/color][/b] - [i]Text to draw.[/i]
[color=#9acd32]color[/color] - [i]Hex color or RGB/RGBA array. Optional.[/i]
[color=#9acd32]size[/color] - [i]Font size. Optional.[/i]

[b]Example:[/b]
[code]drawText(50, 100, "Hello", [255, 0, 0], 12);[/code]`
    },
    {
        name: 'soundPlay',
        threadTitle: 'soundPlay(sound, volume, pitch)',
        content: `Plays an MP3 sound effect from the sfx folder. Sound: filename without .mp3 extension. Volume: 0.0 to 1.0 (default 1.0). Pitch: 1.0 = normal.

[b]Arguments:[/b]
[b][color=#90ee90]sound[/color][/b] - [i]Filename without .mp3 extension (from sfx folder).[/i]
[color=#9acd32]volume[/color] - [i]Volume 0.0 to 1.0. Optional, default 1.0.[/i]
[color=#9acd32]pitch[/color] - [i]Pitch multiplier, 1.0 = normal. Optional.[/i]

[b]Example:[/b]
[code]soundPlay("explosion", 1.0, 1.0);
// or soundPlay("explosion"); // uses default volume and pitch[/code]`
    },
    {
        name: 'drawSprite',
        threadTitle: 'drawSprite(x, y, name, scaleX, scaleY, rotation, color)',
        content: `Draws a sprite from the server. spriteName must start with @ and end with .gif or .png. xScale and yScale are scale factors. color: optional hex color string or RGBA array to tint/blend the sprite.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position.[/i]
[b][color=#90ee90]name[/color][/b] - [i]Sprite filename; must start with @ and end with .gif or .png.[/i]
[b][color=#90ee90]scaleX[/color][/b] - [i]Horizontal scale factor.[/i]
[b][color=#90ee90]scaleY[/color][/b] - [i]Vertical scale factor.[/i]
[color=#9acd32]rotation[/color] - [i]Rotation in degrees. Optional.[/i]
[color=#9acd32]color[/color] - [i]Hex color or RGBA array to tint. Optional.[/i]

[b]Example:[/b]
[code]drawSprite(90, 160, "@grassBlades.gif", 1, 1, 45); // GIF sprite, 1:1 scale, 45° rotation
drawSprite(90, 160, "@sprite.png", 2, 1); // PNG sprite, 2x width, 1x height
drawSprite(90, 160, "@sprite.png", 1, 1, 0, "#FF0000"); // Red tinted sprite[/code]`
    },
    {
        name: 'drawSheetSprite',
        threadTitle: 'drawSheetSprite(x, y, name, frame, maxCellsX, maxCellsY)',
        content: `Draws a frame from a spritesheet. spriteName must start with @ and end with .gif or .png. frame: frame index (0-based). maxCellsX: number of cells horizontally. maxCellsY: number of cells vertically.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position.[/i]
[b][color=#90ee90]name[/color][/b] - [i]Spritesheet filename; must start with @ and end with .gif or .png.[/i]
[b][color=#90ee90]frame[/color][/b] - [i]Frame index (0-based).[/i]
[b][color=#90ee90]maxCellsX[/color][/b] - [i]Number of cells horizontally in the sheet.[/i]
[b][color=#90ee90]maxCellsY[/color][/b] - [i]Number of cells vertically in the sheet.[/i]

[b]Example:[/b]
[code]drawSheetSprite(90, 160, "@spriteSheet.png", 0, 4, 3); // Draw first frame
drawSheetSprite(90, 160, "@spriteSheet.png", 5, 4, 3); // Draw frame 5[/code]`
    },
    {
        name: 'youtubePlay',
        threadTitle: 'youtubePlay(x, y, w, h, url)',
        content: `Embeds a YouTube video at specified world coordinates. x, y: world coordinates for top-left corner. w, h: width and height. url: YouTube URL or video ID.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Top-left x in world coordinates.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Top-left y in world coordinates.[/i]
[b][color=#90ee90]w[/color][/b] - [i]Width.[/i]
[b][color=#90ee90]h[/color][/b] - [i]Height.[/i]
[b][color=#90ee90]url[/color][/b] - [i]YouTube URL or video ID.[/i]

[b]Example:[/b]
[code]youtubePlay(50, 200, 80, 60, "dQw4w9WgXcQ");[/code]`
    },
    {
        name: 'youtubeStop',
        threadTitle: 'youtubeStop()',
        content: `Stops and removes all YouTube video players.

[b]Example:[/b]
[code]youtubeStop(); // Stops all YouTube players[/code]`
    },
    {
        name: 'createObject',
        threadTitle: 'createObject(x, y, name, type)',
        content: `Creates a new instance of a coded object. If typeName is provided, calls the object's type function on creation.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position for the new instance.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position for the new instance.[/i]
[b][color=#90ee90]name[/color][/b] - [i]Object name (codeChild name from the editor).[/i]
[color=#9acd32]type[/color] - [i]Type function to call on creation. Optional.[/i]

[b][color=#ffa500]Returns: the created object or null if failed.[/color][/b]

[b]Example:[/b]
[code]createObject(90, 160, "myObject");
// or createObject(90, 160, "myObject", "myType"); // with type[/code]`
    },
    {
        name: 'makeDraggable',
        threadTitle: 'makeDraggable()',
        content: `Makes the current codeChild draggable (like the player). The object must call this function each frame to remain draggable.

[b]Example:[/b]
[code]makeDraggable(); // Makes this object draggable[/code]`
    },
    {
        name: 'createBullet',
        threadTitle: 'createBullet(x, y, speed, dir, size, ...)',
        content: `Creates a bullet at specified position with given properties (x, y, speed, direction, size required).

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position.[/i]
[b][color=#90ee90]speed[/color][/b] - [i]Bullet speed.[/i]
[b][color=#90ee90]dir[/color][/b] - [i]Direction in degrees.[/i]
[b][color=#90ee90]size[/color][/b] - [i]Bullet size.[/i]
[color=#9acd32]...[/color] - [i]Optional: [R,G,B], Alpha, ScaleY, Rotation, Lifetime, Homing, Spin, Shape, GlowSize, GlowPower, [GlowR,GlowG,GlowB].[/i]

[b][color=#ffa500]Returns: the bullet's unique ID.[/color][/b]

[b]Example:[/b]
[code]var bulletId = createBullet(x, y, 5, 90, 2, [255, 0, 0], 1, 1.0, 0, 2.0, 0.3);[/code]`
    },
    {
        name: 'drawAnimated',
        threadTitle: 'drawAnimated(x, y, name, anim, bones, scaleX, scaleY)',
        content: `Displays an animated character sprite at specified position.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position.[/i]
[b][color=#90ee90]name[/color][/b] - [i]DragonBones armature name (asset name).[/i]
[b][color=#90ee90]anim[/color][/b] - [i]Animation name to play.[/i]
[color=#9acd32]bones[/color] - [i]Array of bone names to hide. Optional.[/i]
[color=#9acd32]scaleX[/color] - [i]Horizontal scale. Optional.[/i]
[color=#9acd32]scaleY[/color] - [i]Vertical scale. Optional.[/i]

[b][color=#ffa500]Returns: a handle object that allows control of the animation.[/color][/b]

[b]Example:[/b]
[code]var animX = 90;
var animY = 160;
var bonesToHide = ["arm_L", "arm_R"];
var handle = drawAnimated(animX, animY, "ForestBee", "Idle", bonesToHide, 2, 2);[/code]`
    },
    {
        name: 'destroy',
        threadTitle: 'destroy(id)',
        content: `Removes the specified instance or self if no id provided.

[b]Arguments:[/b]
[color=#9acd32]id[/color] - [i]Instance/codeChild ID to remove. Omit to remove self.[/i]

[b][color=#ffa500]Returns: true if removal was successful, false otherwise.[/color][/b]

[b]Example:[/b]
[code]destroy(); // removes self
// or destroy(123); // removes codeChild with id 123[/code]`
    },
    {
        name: 'debugMessage',
        threadTitle: 'debugMessage(msg)',
        content: `Adds a debug message to the chat tab.

[b]Arguments:[/b]
[b][color=#90ee90]msg[/color][/b] - [i]Message to show in the chat/debug tab.[/i]

[b]Example:[/b]
[code]debugMessage("Player HP: " + playerHp);[/code]`
    },
    {
        name: 'objectOutScreen',
        threadTitle: 'objectOutScreen(x, y, margin)',
        content: `Checks if the object at specified position is outside screen bounds.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position to check.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position to check.[/i]
[color=#9acd32]margin[/color] - [i]Extra margin (0-1 or pixels) outside the visible area. Optional.[/i]

[b][color=#ffa500]Returns: true if outside screen, false otherwise.[/color][/b]

[b]Example:[/b]
[code]if (objectOutScreen(x, y, 0.1)) { dead = true; }[/code]`
    },
    {
        name: 'collidePlayerBullet',
        threadTitle: 'collidePlayerBullet(x, y, radius)',
        content: `Finds all player bullet IDs within radius of (x,y) this frame.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Center x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Center y position.[/i]
[b][color=#90ee90]radius[/color][/b] - [i]Search radius.[/i]

[b][color=#ffa500]Returns: an array of player bullet IDs; [] if none.[/color][/b]

[b]Example:[/b]
[code]var bids = collidePlayerBullet(x, y, 8);
inBullet(bids)
# alpha = 0.2;[/code]`
    },
    {
        name: 'colideOtherObject',
        threadTitle: 'colideOtherObject(x, y, radius, tag, size)',
        content: `Circle vs circle collision detection. Skips self.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]Center x position.[/i]
[b][color=#90ee90]y[/color][/b] - [i]Center y position.[/i]
[b][color=#90ee90]radius[/color][/b] - [i]Collision radius for this object.[/i]
[b][color=#90ee90]tag[/color][/b] - [i]Tag to filter objects by. Only objects with this tag are considered.[/i]
[b][color=#90ee90]size[/color][/b] - [i]Radius to use for the other objects (or their collision size).[/i]

[b][color=#ffa500]Returns: the first colliding codeChild or null.[/color][/b]

[b]Example:[/b]
[code]var other = colideOtherObject(x, y, 8, "enemy", 6);
if (other !== null) { other.hp -= 1; }[/code]`
    },
    {
        name: 'background',
        threadTitle: 'background(name)',
        content: `Creates a static background that is baked into a vertex buffer at compilation time.

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]Buffer name. Use with drawBackground(x, y, "name") to draw it.[/i]

[b]Example:[/b]
[code]background("bg1")
#drawCircle(90, 160, 4)
// Later:
drawBackground(0, 0, "bg1")[/code]`
    },
    {
        name: 'drawBackground',
        threadTitle: 'drawBackground(x, y, name)',
        content: `Draws a background buffer at specified position.

[b]Arguments:[/b]
[b][color=#90ee90]x[/color][/b] - [i]x position to draw at.[/i]
[b][color=#90ee90]y[/color][/b] - [i]y position to draw at.[/i]
[b][color=#90ee90]name[/color][/b] - [i]Name of the background buffer (from background("name")).[/i]

[b]Example:[/b]
[code]background("myBg")
#drawCircle(0, 0, 4)
// Later:
drawBackground(90, 160, "myBg")[/code]`
    },
    {
        name: 'musicPlay',
        threadTitle: 'musicPlay(name, seq, vol)',
        content: `Plays a soundtrack file from music/soundtracks/. songName must start with $.

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]Song filename; must start with $ (from music/soundtracks/).[/i]
[color=#9acd32]seq[/color] - [i]Starting sequence/order number. Optional.[/i]
[color=#9acd32]vol[/color] - [i]Volume 0-1. Optional.[/i]

[b]Example:[/b]
[code]musicPlay("$lethal-weapon-level-1.xm");
musicPlay("$song.xm", 2, 0.5);[/code]`
    },
    {
        name: 'musicStop',
        threadTitle: 'musicStop()',
        content: `Stops the currently playing soundtrack.`
    },
    {
        name: 'musicGetSequence',
        threadTitle: 'musicGetSequence()',
        content: `Gets the current sequence/order number of the currently played soundtrack.

[b][color=#ffa500]Returns: the current sequence/order number.[/color][/b]`
    },
    {
        name: 'musicSetSequence',
        threadTitle: 'musicSetSequence(seq)',
        content: `Instantly plays the current song from the specified sequence/order number.

[b]Arguments:[/b]
[b][color=#90ee90]seq[/color][/b] - [i]Sequence/order number to jump to.[/i]
`
    }
];

export const dragonBonesHelp = [
    {
        name: 'Example: basic handle',
        content: `[b]Example:[/b]
[code]var ani = drawAnimated(x, y, "ForestBee", "Idle");

// You can set display properties:
ani.scale = 0.7;
ani.alpha = 0.9;
// ani.rotation = 0.3;[/code]`
    },
    {
        name: 'ani.armature.getBone(name)',
        content: `Finds a bone by name on the armature.

[b]Arguments:[/b]
[b][color=#90ee90]name[/color][/b] - [i]Bone name on the armature.[/i]

[b][color=#ffa500]Returns: dragonBones.Bone or null if not found.[/color][/b]
[code]var bone = ani.armature.getBone("arm");[/code]`
    },
    {
        name: 'bone.visible',
        content: `Shows or hides a bone (and typically its attached slot visuals).

[b][color=#ffa500]Type: boolean[/color][/b]
[code]bone.visible = false; // hide
bone.visible = true;  // show[/code]`
    },
    {
        name: 'bone.origin',
        content: `The bone’s original/default transform (from the skeleton data). Useful as a baseline.
[b]Note:[/b] this is different from [color=#ffa500]bone.global[/color] (current pose) and [color=#ffa500]bone.offset[/color] (your override).

[b]Example:[/b]
[code]var o = bone.origin;
// example fields:
// o.x, o.y, o.scaleX, o.scaleY, o.rotation[/code]`
    },
    {
        name: 'Example: animation',
        content: `The animation handle (ani) provides display properties (Pixi) and animation controller properties (DragonBones).

[b]Example:[/b]
[code]var ani = drawAnimated(x, y, "ForestBee", "Idle");

// Display properties (Pixi):
ani.angle = 45;           // Rotation in degrees
ani.alpha = 0.8;          // Opacity (0-1)

// Animation controller properties:
var currentTime = ani.animation.currentTime;  // Current playback time
var isPlaying = ani.animation.isPlaying;      // Whether animation is playing
ani.animation.timeScale = 1.5;                // Playback speed[/code]`
    },
    {
        name: 'Example: bones',
        content: `[b]Example:[/b]
[code]var ani = drawAnimated(x, y, "ForestBee", "Idle");
if (ani.ready) {
  var bone = ani.armature.getBone("arm");
  bone.offset.x += 10;
  bone.invalidUpdate();
}[/code]`
    }
];

export const javaScriptStuffHelp = [
    // Keywords are now handled in a separate "Keywords" subcategory under "JavaScript Stuff"
];

export const mathFunctionsHelp = [
    { name: 'abs(x)', content: `Absolute value` },
    { name: 'atan2(y, x)', content: `Arc tangent of y/x.

[b][color=#ffa500]Returns: angle in radians.[/color][/b]` },
    { name: 'ceil(x)', content: `Round up` },
    { name: 'cos(x)', content: `Cosine (radians)` },
    { name: 'E', content: `Euler's number` },
    { name: 'floor(x)', content: `Round down` },
    { name: 'max(a, b, ...)', content: `Maximum value` },
    { name: 'min(a, b, ...)', content: `Minimum value` },
    { name: 'PI', content: `Pi constant (3.14159...)` },
    { name: 'pow(x, y)', content: `x to power of y` },
    { name: 'random()', content: `Random 0-1` },
    { name: 'round(x)', content: `Round to nearest` },
    { name: 'sin(x)', content: `Sine (radians)` },
    { name: 'sqrt(x)', content: `Square root` },
    { name: 'tan(x)', content: `Tangent (radians)` }
];

export const arrayMethodsHelp = [
    { name: 'array.length', content: `Get array length` },
    { name: 'array.push(item)', content: `Add item to end` },
    { name: 'array.pop()', content: `Remove last item` },
    { name: 'array.shift()', content: `Remove first item` },
    { name: 'array.unshift(item)', content: `Add item to start` },
    { name: 'array.indexOf(item)', content: `Find index of item` },
    { name: 'array.includes(item)', content: `Check if contains item` },
    { name: 'array.slice(start, end)', content: `Get sub-array` },
    { name: 'array.splice(i, n, ...)', content: `Remove/insert items` },
    { name: 'array.forEach(fn)', content: `Loop through items` },
    { name: 'array.map(fn)', content: `Transform array` },
    { name: 'array.filter(fn)', content: `Filter array` },
    { name: 'array.find(fn)', content: `Find first match` },
    { name: 'array.join(sep)', content: `Join to string` }
];

export const stringMethodsHelp = [
    { name: 'string.length', content: `Get string length` },
    { name: 'string.charAt(i)', content: `Get character at index` },
    { name: 'string.indexOf(str)', content: `Find substring index` },
    { name: 'string.includes(str)', content: `Check if contains` },
    { name: 'string.substring(s, e)', content: `Get substring` },
    { name: 'string.slice(s, e)', content: `Get substring` },
    { name: 'string.split(sep)', content: `Split to array` },
    { name: 'string.toLowerCase()', content: `Convert to lowercase` },
    { name: 'string.toUpperCase()', content: `Convert to uppercase` },
    { name: 'string.trim()', content: `Remove whitespace` },
    { name: 'string.replace(a, b)', content: `Replace substring` }
];

export const numberMethodsHelp = [
    { name: 'Number.parseInt(str)', content: `Parse integer` },
    { name: 'Number.parseFloat(str)', content: `Parse float` },
    { name: 'num.toFixed(n)', content: `Format to n decimals` },
    { name: 'num.toString()', content: `Convert to string` },
    { name: 'isNaN(x)', content: `Check if not a number` },
    { name: 'isFinite(x)', content: `Check if finite number` }
];

export const globalFunctionsHelp = [
    { name: 'Object.keys(obj)', content: `Get object keys as array` },
    { name: 'Object.values(obj)', content: `Get object values as array` },
    { name: 'Object.assign(target, src)', content: `Copy properties to target` },
    { name: 'Object.entries(obj)', content: `Get [key, value] pairs` },
    { name: 'Object.hasOwnProperty(key)', content: `Check if property exists` },
    { name: 'Date.now()', content: `Current timestamp (milliseconds)` },
    { name: 'new Date()', content: `Create date object` },
    { name: 'new Date(timestamp)', content: `Create date from timestamp` },
    { name: 'parseInt(str)', content: `Parse string to integer` },
    { name: 'parseFloat(str)', content: `Parse string to float` },
    { name: 'isNaN(x)', content: `Check if not a number` },
    { name: 'isFinite(x)', content: `Check if finite number` },
    { name: 'encodeURIComponent(str)', content: `Encode URI component` },
    { name: 'decodeURIComponent(str)', content: `Decode URI component` },
    { name: 'String(x)', content: `Convert to string` },
    { name: 'Number(x)', content: `Convert to number` },
    { name: 'Boolean(x)', content: `Convert to boolean` },
    { name: 'Array.isArray(x)', content: `Check if is array` }
];

export const arrayConstructorHelp = [
    { name: 'new Array()', content: `Create empty array` },
    { name: 'new Array(n)', content: `Create array with n elements` },
    { name: 'new Array(a, b, c)', content: `Create array with elements` },
    { name: '[1, 2, 3]', content: `Array literal syntax` },
    { name: 'Array.from(obj)', content: `Create array from iterable` },
    { name: 'Array.of(...args)', content: `Create array from arguments` }
];

export const stringNumberConstructorsHelp = [
    { name: 'new String(str)', content: `Create string object` },
    { name: '"text" or \'text\'', content: `String literal` },
    { name: 'template literal', content: `Template literal syntax using backticks` },
    { name: 'new Number(n)', content: `Create number object` },
    { name: '123 or 12.34', content: `Number literal` },
    { name: '0x123', content: `Hexadecimal literal` }
];