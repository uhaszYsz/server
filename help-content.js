// server/help-content.js
// Export help content as BBCode for forum initialization

export const specialKeywordsHelp = [
    {
        name: 'background',
        content: `[b]Description:[/b] Bakes all draws to a vertex buffer we store under name provided as argument. Use drawBackground(x, y, "name") to use baked backgrounds. Happens once at compilation.
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
        content: `[b]Description:[/b] Define a variable with initial value. Variable persists across frames.
[b]Example:[/b]
[code]def myVar = 10;
def myString = "hello";[/code]
[i]Defines two variables that persist across frames.[/i]`
    },
    {
        name: 'globalvar',
        content: `[b]Description:[/b] Define a global variable with initial value. Initialized only once, shared across ALL codeChildren (all objects).
[b]Example:[/b]
[code]globalvar score = 0;

// In any object:
score += 1;[/code]
[i]Creates a shared score counter accessible from every object.[/i]`
    },
    {
        name: 'inBullet',
        content: `[b]Description:[/b] Allows you to manipulate bullet parameters. Accepts a single bullet ID or an array of IDs.
[b]Example:[/b]
[code]var Id = createBullet(X, Y, 5, direction, 2)
inBullet(Id)
#Alpha = 0.2[/code]
[i]Sets Alpha for one bullet by its Id.[/i]`
    },
    {
        name: 'repeat',
        content: `[b]Description:[/b] Repeat a block of code n times. Use indentation (#) to define the block.
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
        content: `[b]Description:[/b] Player object. 
[b]Properties:[/b] [color=#ffa500]X[/color], [color=#ffa500]Y[/color], [color=#ffa500]hp[/color], [color=#ffa500]knockbackTime[/color], [color=#ffa500]knockbackPower[/color], [color=#ffa500]knockbackDirection[/color]`
    },
    {
        name: 'bulletData',
        content: `[b]Description:[/b] List (array) of all existing bullets and their parameters. Use inBullet() to iterate. 
[b]Properties:[/b] [color=#ffa500]Id[/color], [color=#ffa500]X[/color], [color=#ffa500]Y[/color], [color=#ffa500]R[/color], [color=#ffa500]G[/color], [color=#ffa500]B[/color], [color=#ffa500]Alpha[/color], [color=#ffa500]Size[/color], [color=#ffa500]ScaleY[/color], [color=#ffa500]Rotation[/color], [color=#ffa500]Lifetime[/color], [color=#ffa500]Homing[/color], [color=#ffa500]Spin[/color], [color=#ffa500]Shape[/color], [color=#ffa500]GlowSize[/color], [color=#ffa500]GlowPower[/color], [color=#ffa500]GlowR[/color], [color=#ffa500]GlowG[/color], [color=#ffa500]GlowB[/color]`
    },
    {
        name: 'bulletCount',
        content: `[b]Description:[/b] Number of active bullets`
    },
    {
        name: 'tapX',
        content: `[b]Description:[/b] Mouse/tap X position in world coordinates`
    },
    {
        name: 'tapY',
        content: `[b]Description:[/b] Mouse/tap Y position in world coordinates`
    },
    {
        name: 'X',
        content: `[b]Description:[/b] X position of the current object`
    },
    {
        name: 'Y',
        content: `[b]Description:[/b] Y position of the current object`
    },
    {
        name: 'speed',
        content: `[b]Description:[/b] Speed of the current object`
    },
    {
        name: 'direction',
        content: `[b]Description:[/b] Direction in degrees of the current object`
    },
    {
        name: 'Id',
        content: `[b]Description:[/b] Unique ID of this codeChild`
    }
];

export const danmakuHelpersHelp = [
    {
        name: 'getSelf',
        content: `[b]Description:[/b] Returns a reference to the current running object (codeChild). This is NOT a copy. You can read/write properties on it (e.g. getSelf().x = 0).
\n[b][color=#ffa500]Returns:[/color][/b] a reference to the current running object.
[b]Example:[/b]
[code]var self = getSelf();
self.x = 0;
self.speed = 2;[/code]`
    },
    {
        name: 'getDirection',
        content: `[b]Description:[/b] Calculates the direction angle in degrees from current position to target point. 
\n[b][color=#ffa500]Returns:[/color][/b] the angle in degrees (0-360).
[b]Example:[/b]
[code]var dir = getDirection(100, 200);[/code]`
    },
    {
        name: 'normalizeAngle',
        content: `[b]Description:[/b] Normalizes numbers like -90 or 450 to 0-360 direction. 
\n[b][color=#ffa500]Returns:[/color][/b] the normalized angle as a number.
[b]Example:[/b]
[code]direction = normalizeAngle(450); // returns 90[/code]`
    },
    {
        name: 'angleDifference',
        content: `[b]Description:[/b] Calculates the shortest angle difference between two angles in degrees. 
\n[b][color=#ffa500]Returns:[/color][/b] the angle difference as a number (can be negative).
[b]Example:[/b]
[code]var diff = angleDifference(0, 270); // returns -90[/code]`
    },
    {
        name: 'getDistance',
        content: `[b]Description:[/b] Calculates the distance from current position to target point. 
\n[b][color=#ffa500]Returns:[/color][/b] the distance as a number.
[b]Example:[/b]
[code]var dist = getDistance(100, 200);[/code]`
    },
    {
        name: 'lenDirX',
        content: `[b]Description:[/b] Converts length and direction (angle in degrees) to X component. 
\n[b][color=#ffa500]Returns:[/color][/b] the X component as a number.
[b]Example:[/b]
[code]var offsetX = lenDirX(10, 90); // returns 0 (straight up)[/code]`
    },
    {
        name: 'lenDirY',
        content: `[b]Description:[/b] Converts length and direction (angle in degrees) to Y component. 
\n[b][color=#ffa500]Returns:[/color][/b] the Y component as a number.
[b]Example:[/b]
[code]var offsetY = lenDirY(10, 90); // returns 10 (straight up)[/code]`
    },
    {
        name: 'move',
        content: `[b]Description:[/b] Moves the instance by the given length in the given direction (angle in degrees). Modifies X and Y positions directly.
[b]Example:[/b]
[code]move(5, 90); // moves 5 pixels upward
move(10, 0); // moves 10 pixels to the right[/code]`
    },
    {
        name: 'isUndef',
        content: `[b]Description:[/b] Checks if a variable is undefined or not declared. 
\n[b][color=#ffa500]Returns:[/color][/b] true if undefined, false otherwise.
[b]Example:[/b]
[code]if (isUndef(myVar)) { /* variable is undefined or not declared */ }[/code]`
    },
    {
        name: 'rand',
        content: `[b]Description:[/b] Generates random number between min and max. 
\n[b][color=#ffa500]Returns:[/color][/b] a random number.
[b]Example:[/b]
[code]var value = rand(-100, 100); // random number between -100 and 100[/code]`
    },
    {
        name: 'isEnemy',
        content: `[b]Description:[/b] Marks the current object as an enemy. When called, the object will have isEnemy=true and will be added to the global enemyList.
[b]Example:[/b]
[code]isEnemy(); // mark this object as an enemy[/code]`
    },
    {
        name: 'enemyList',
        content: `[b]Description:[/b] Returns a global array of all active objects marked as enemies.
\n[b][color=#ffa500]Returns:[/color][/b] a global array of all active objects marked as enemies.
[b]Example:[/b]
[code]var enemies = enemyList();
for(var i=0; i<enemies.length; i++) {
  var e = enemies[i];
  // do something with enemy
}[/code]`
    },
    {
        name: 'init',
        content: `[b]Description:[/b] Returns true only once at initialization. 
\n[b][color=#ffa500]Returns:[/color][/b] true on instance create and stays false forever.
[b]Example:[/b]
[code]if (init()) { /* danmakuINIT is undefined */ }[/code]`
    },
    {
        name: 'turnTowards',
        content: `[b]Description:[/b] Gradually turns the current direction towards target direction, limited by maxTurn degrees per frame. 
\n[b][color=#ffa500]Returns:[/color][/b] true if speed is greater than 0, false otherwise.
[b]Example:[/b]
[code]turnTowards(90, 5); // turns up to 5 degrees towards 90[/code]`
    },
    {
        name: 'turnTowardsPlayer',
        content: `[b]Description:[/b] Gradually turns the current direction towards the player, limited by maxTurn degrees per frame. 
\n[b][color=#ffa500]Returns:[/color][/b] true if player exists and speed is greater than 0, false otherwise.
[b]Example:[/b]
[code]turnTowardsPlayer(3);[/code]`
    },
    {
        name: 'waveStart',
        content: `[b]Description:[/b] Selects a wave by its id/number (stage editor waves). 
\n[b][color=#ffa500]Returns:[/color][/b] true if the wave exists and was selected, false otherwise.
[b]Example:[/b]
[code]waveStart(1); // select Wave 1
waveStart(2); // select Wave 2[/code]`
    },
    {
        name: 'waveGetCurrent',
        content: `[b]Description:[/b] Returns the current wave number (stage editor wave id).
\n[b][color=#ffa500]Returns:[/color][/b] the current wave number.
[b]Example:[/b]
[code]var w = waveGetCurrent();
drawText(5, 5, "Wave: " + w);[/code]`
    },
    {
        name: 'waveStartNext',
        content: `[b]Description:[/b] Selects the next wave in the stage editor. 
\n[b][color=#ffa500]Returns:[/color][/b] true if it switched to the next wave, false otherwise.
[b]Example:[/b]
[code]waveStartNext();[/code]`
    },
    {
        name: 'drawCircle',
        content: `[b]Description:[/b] Draws a circle at specified position with optional outline and color.
[b]Example:[/b]
[code]drawCircle(100, 200, 5); // filled white circle
// or drawCircle(100, 200, 5, 1); // outline with width 1
// or drawCircle(100, 200, 5, 0, "#ff0000"); // red filled circle[/code]`
    },
    {
        name: 'drawRectangle',
        content: `[b]Description:[/b] Draws a rectangle at specified position with optional color. x, y: bottom-left corner position. w, h: width and height.
[b]Example:[/b]
[code]drawRectangle(10, 20, 50, 30); // white rectangle
// or drawRectangle(10, 20, 50, 30, "#ff0000"); // red rectangle
// or drawRectangle(10, 20, 50, 30, [1.0, 0.0, 0.0, 0.5]); // red rectangle with 50% opacity[/code]`
    },
    {
        name: 'drawGround',
        content: `[b]Description:[/b] Draws a grid of rectangles covering the whole world. cellWidth and cellHeight are the dimensions of each grid cell.
[b]Example:[/b]
[code]drawGround(10, 10, [1.0, 0.0, 0.0, 1.0]); // red grid with 10x10 cells
// or drawGround(5, 5, "#0000ff"); // blue grid with 5x5 cells
// or drawGround(); // default white grid with 10x10 cells[/code]`
    },
    {
        name: 'drawLight',
        content: `[b]Description:[/b] Adds a light source that makes ground squares lighter based on distance. Closer squares become lighter. x and y are the light position. radius is the effect radius (optional, default: 50). power is the light intensity 0-1 (optional, default: 1.0).
[b]Example:[/b]
[code]drawLight(90, 160, 50, 1.0); // bright light at center
// or drawLight(x, y, 30, 0.5); // dimmer light with smaller radius[/code]`
    },
    {
        name: 'clearLights',
        content: `[b]Description:[/b] Clears all light sources. Call at the start of each frame to reset lighting.
[b]Example:[/b]
[code]clearLights(); // remove all lights[/code]`
    },
    {
        name: 'didTapped',
        content: `[b]Description:[/b] Checks if screen was just touched. 
\n[b][color=#ffa500]Returns:[/color][/b] true if tapped this frame, false otherwise.
[b]Example:[/b]
[code]if (didTapped()) { /* handle tap */ }[/code]`
    },
    {
        name: 'didReleased',
        content: `[b]Description:[/b] Checks if touch on screen was just released. 
\n[b][color=#ffa500]Returns:[/color][/b] true if released this frame, false otherwise.
[b]Example:[/b]
[code]if (didReleased()) { /* handle release */ }[/code]`
    },
    {
        name: 'drawText',
        content: `[b]Description:[/b] Draws text at specified position with optional color and size.
[b]Example:[/b]
[code]drawText(50, 100, "Hello", [255, 0, 0], 12);[/code]`
    },
    {
        name: 'soundPlay',
        content: `[b]Description:[/b] Plays an MP3 sound effect from the sfx folder. Sound: filename without .mp3 extension. Volume: 0.0 to 1.0 (default 1.0). Pitch: 1.0 = normal.
[b]Example:[/b]
[code]soundPlay("explosion", 1.0, 1.0);
// or soundPlay("explosion"); // uses default volume and pitch[/code]`
    },
    {
        name: 'drawSprite',
        content: `[b]Description:[/b] Draws a sprite from the server. spriteName must start with @ and end with .gif or .png. xScale and yScale are scale factors. color: optional hex color string or RGBA array to tint/blend the sprite.
[b]Example:[/b]
[code]drawSprite(90, 160, "@grassBlades.gif", 1, 1, 45); // GIF sprite, 1:1 scale, 45° rotation
drawSprite(90, 160, "@sprite.png", 2, 1); // PNG sprite, 2x width, 1x height
drawSprite(90, 160, "@sprite.png", 1, 1, 0, "#FF0000"); // Red tinted sprite[/code]`
    },
    {
        name: 'drawSheetSprite',
        content: `[b]Description:[/b] Draws a frame from a spritesheet. spriteName must start with @ and end with .gif or .png. frame: frame index (0-based). maxCellsX: number of cells horizontally. maxCellsY: number of cells vertically.
[b]Example:[/b]
[code]drawSheetSprite(90, 160, "@spriteSheet.png", 0, 4, 3); // Draw first frame
drawSheetSprite(90, 160, "@spriteSheet.png", 5, 4, 3); // Draw frame 5[/code]`
    },
    {
        name: 'youtubePlay',
        content: `[b]Description:[/b] Embeds a YouTube video at specified world coordinates. x, y: world coordinates for top-left corner. w, h: width and height. url: YouTube URL or video ID.
[b]Example:[/b]
[code]youtubePlay(50, 200, 80, 60, "dQw4w9WgXcQ");[/code]`
    },
    {
        name: 'youtubeStop',
        content: `[b]Description:[/b] Stops and removes all YouTube video players.
[b]Example:[/b]
[code]youtubeStop(); // Stops all YouTube players[/code]`
    },
    {
        name: 'createObject',
        content: `[b]Description:[/b] Creates new instance of coded object. If typeName is provided, calls the object's type function on creation. 
\n[b][color=#ffa500]Returns:[/color][/b] the created object or null if failed.
[b]Example:[/b]
[code]createObject(90, 160, "myObject");
// or createObject(90, 160, "myObject", "myType"); // with type[/code]`
    },
    {
        name: 'makeDraggable',
        content: `[b]Description:[/b] Makes the current codeChild draggable (like the player). The object must call this function each frame to remain draggable.
[b]Example:[/b]
[code]makeDraggable(); // Makes this object draggable[/code]`
    },
    {
        name: 'createBullet',
        content: `[b]Description:[/b] Creates a bullet at specified position with given properties (x, y, speed, direction, size required). 
\n[b][color=#ffa500]Returns:[/color][/b] the bullet's unique ID.
[b]Example:[/b]
[code]var bulletId = createBullet(x, y, 5, 90, 2, [255, 0, 0], 1, 1.0, 0, 2.0, 0.3);[/code]`
    },
    {
        name: 'drawAnimated',
        content: `[b]Description:[/b] Displays an animated character sprite at specified position. 
\n[b][color=#ffa500]Returns:[/color][/b] a handle object that allows control of the animation.
[b]Example:[/b]
[code]var animX = 90;
var animY = 160;
var bonesToHide = ["arm_L", "arm_R"];
var handle = drawAnimated(animX, animY, "ForestBee", "Idle", bonesToHide, 2, 2);[/code]`
    },
    {
        name: 'destroy',
        content: `[b]Description:[/b] Removes specified instance or self if no id provided. 
\n[b][color=#ffa500]Returns:[/color][/b] true if removal was successful, false otherwise.
[b]Example:[/b]
[code]destroy(); // removes self
// or destroy(123); // removes codeChild with id 123[/code]`
    },
    {
        name: 'debugMessage',
        content: `[b]Description:[/b] Adds a debug message to the chat tab.
[b]Example:[/b]
[code]debugMessage("Player HP: " + playerHp);[/code]`
    },
    {
        name: 'objectOutScreen',
        content: `[b]Description:[/b] Checks if the object at specified position is outside screen bounds. 
\n[b][color=#ffa500]Returns:[/color][/b] true if outside screen, false otherwise.
[b]Example:[/b]
[code]if (objectOutScreen(x, y, 0.1)) { dead = true; }[/code]`
    },
    {
        name: 'collidePlayerBullet',
        content: `[b]Description:[/b] Returns an array of all player bullet IDs within radius of (x,y) this frame. [] if none.
\n[b][color=#ffa500]Returns:[/color][/b] an array of all player bullet IDs within radius of (x,y) this frame. [] if none.
[b]Example:[/b]
[code]var bids = collidePlayerBullet(x, y, 8);
inBullet(bids)
# alpha = 0.2;[/code]`
    },
    {
        name: 'colideOtherObject',
        content: `[b]Description:[/b] Circle vs circle collision detection. Skips self.
\n[b][color=#ffa500]Returns:[/color][/b] the first colliding codeChild or null.
[b]Example:[/b]
[code]var other = colideOtherObject(x, y, 8, "enemy", 6);
if (other !== null) { other.hp -= 1; }[/code]`
    },
    {
        name: 'background',
        content: `[b]Description:[/b] Creates a static background that is baked into a vertex buffer at compilation time.
[b]Example:[/b]
[code]background("bg1")
#drawCircle(90, 160, 4)
// Later:
drawBackground(0, 0, "bg1")[/code]`
    },
    {
        name: 'drawBackground',
        content: `[b]Description:[/b] Draws a background buffer at specified position.
[b]Example:[/b]
[code]background("myBg")
#drawCircle(0, 0, 4)
// Later:
drawBackground(90, 160, "myBg")[/code]`
    },
    {
        name: 'musicPlay',
        content: `[b]Description:[/b] Plays a soundtrack file from music/soundtracks/. songName must start with $.
[b]Example:[/b]
[code]musicPlay("$lethal-weapon-level-1.xm");
musicPlay("$song.xm", 2, 0.5);[/code]`
    },
    {
        name: 'musicStop',
        content: `[b]Description:[/b] Stops the currently playing soundtrack.`
    },
    {
        name: 'musicGetSequence',
        content: `[b]Description:[/b] Gets the current sequence/order number of the currently played soundtrack.
\n[b][color=#ffa500]Returns:[/color][/b] the current sequence/order number.`
    },
    {
        name: 'musicSetSequence',
        content: `[b]Description:[/b] Instantly plays the current song from the specified sequence/order number.`
    }
];

export const dragonBonesHelp = [
    {
        name: 'Example: basic handle',
        content: `[code]var ani = drawAnimated(x, y, "ForestBee", "Idle");

// You can set display properties:
ani.scale = 0.7;
ani.alpha = 0.9;
// ani.rotation = 0.3;[/code]`
    },
    {
        name: 'ani.armature.getBone(name)',
        content: `[b]Description:[/b] Finds a bone by name on the armature.
\n[b][color=#ffa500]Returns:[/color][/b] [color=#ffa500]dragonBones.Bone[/color] or [color=#ffa500]null[/color] if not found.
[code]var bone = ani.armature.getBone("arm");[/code]`
    },
    {
        name: 'bone.visible',
        content: `[b]Description:[/b] Shows/hides a bone (and typically its attached slot visuals).
\n[b][color=#ffa500]Type:[/color][/b] [color=#ffa500]boolean[/color]
[code]bone.visible = false; // hide
bone.visible = true;  // show[/code]`
    },
    {
        name: 'bone.origin',
        content: `[b]Description:[/b] The bone’s original/default transform (from the skeleton data). Useful as a baseline.
[b]Note:[/b] this is different from [color=#ffa500]bone.global[/color] (current pose) and [color=#ffa500]bone.offset[/color] (your override).
[code]var o = bone.origin;
// example fields:
// o.x, o.y, o.scaleX, o.scaleY, o.rotation[/code]`
    },
    {
        name: 'Example: animation',
        content: `[b]Description:[/b] The animation handle (ani) provides display properties (Pixi) and animation controller properties (DragonBones).
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
        content: `[code]var ani = drawAnimated(x, y, "ForestBee", "Idle");
if (ani.ready) {
  var bone = ani.armature.getBone("arm");
  bone.offset.x += 10;
  bone.invalidUpdate();
}[/code]`
    }
];

export const javaScriptStuffHelp = [
    {
        name: 'Keywords',
        content: `[b]JavaScript Keywords:[/b]
[code]function, var, let, const, def, if, else, for, while, switch, case, break, continue, return, true, false, null, undefined, inBullet[/code]`
    }
];

export const mathFunctionsHelp = [
    { name: 'abs(x)', content: `[b]Description:[/b] Absolute value` },
    { name: 'atan2(y, x)', content: `[b]Description:[/b] Arc tangent (returns radians)` },
    { name: 'ceil(x)', content: `[b]Description:[/b] Round up` },
    { name: 'cos(x)', content: `[b]Description:[/b] Cosine (radians)` },
    { name: 'E', content: `[b]Description:[/b] Euler's number` },
    { name: 'floor(x)', content: `[b]Description:[/b] Round down` },
    { name: 'max(a, b, ...)', content: `[b]Description:[/b] Maximum value` },
    { name: 'min(a, b, ...)', content: `[b]Description:[/b] Minimum value` },
    { name: 'PI', content: `[b]Description:[/b] Pi constant (3.14159...)` },
    { name: 'pow(x, y)', content: `[b]Description:[/b] x to power of y` },
    { name: 'random()', content: `[b]Description:[/b] Random 0-1` },
    { name: 'round(x)', content: `[b]Description:[/b] Round to nearest` },
    { name: 'sin(x)', content: `[b]Description:[/b] Sine (radians)` },
    { name: 'sqrt(x)', content: `[b]Description:[/b] Square root` },
    { name: 'tan(x)', content: `[b]Description:[/b] Tangent (radians)` }
];

export const arrayMethodsHelp = [
    { name: 'array.length', content: `[b]Description:[/b] Get array length` },
    { name: 'array.push(item)', content: `[b]Description:[/b] Add item to end` },
    { name: 'array.pop()', content: `[b]Description:[/b] Remove last item` },
    { name: 'array.shift()', content: `[b]Description:[/b] Remove first item` },
    { name: 'array.unshift(item)', content: `[b]Description:[/b] Add item to start` },
    { name: 'array.indexOf(item)', content: `[b]Description:[/b] Find index of item` },
    { name: 'array.includes(item)', content: `[b]Description:[/b] Check if contains item` },
    { name: 'array.slice(start, end)', content: `[b]Description:[/b] Get sub-array` },
    { name: 'array.splice(i, n, ...)', content: `[b]Description:[/b] Remove/insert items` },
    { name: 'array.forEach(fn)', content: `[b]Description:[/b] Loop through items` },
    { name: 'array.map(fn)', content: `[b]Description:[/b] Transform array` },
    { name: 'array.filter(fn)', content: `[b]Description:[/b] Filter array` },
    { name: 'array.find(fn)', content: `[b]Description:[/b] Find first match` },
    { name: 'array.join(sep)', content: `[b]Description:[/b] Join to string` }
];

export const stringMethodsHelp = [
    { name: 'string.length', content: `[b]Description:[/b] Get string length` },
    { name: 'string.charAt(i)', content: `[b]Description:[/b] Get character at index` },
    { name: 'string.indexOf(str)', content: `[b]Description:[/b] Find substring index` },
    { name: 'string.includes(str)', content: `[b]Description:[/b] Check if contains` },
    { name: 'string.substring(s, e)', content: `[b]Description:[/b] Get substring` },
    { name: 'string.slice(s, e)', content: `[b]Description:[/b] Get substring` },
    { name: 'string.split(sep)', content: `[b]Description:[/b] Split to array` },
    { name: 'string.toLowerCase()', content: `[b]Description:[/b] Convert to lowercase` },
    { name: 'string.toUpperCase()', content: `[b]Description:[/b] Convert to uppercase` },
    { name: 'string.trim()', content: `[b]Description:[/b] Remove whitespace` },
    { name: 'string.replace(a, b)', content: `[b]Description:[/b] Replace substring` }
];

export const numberMethodsHelp = [
    { name: 'Number.parseInt(str)', content: `[b]Description:[/b] Parse integer` },
    { name: 'Number.parseFloat(str)', content: `[b]Description:[/b] Parse float` },
    { name: 'num.toFixed(n)', content: `[b]Description:[/b] Format to n decimals` },
    { name: 'num.toString()', content: `[b]Description:[/b] Convert to string` },
    { name: 'isNaN(x)', content: `[b]Description:[/b] Check if not a number` },
    { name: 'isFinite(x)', content: `[b]Description:[/b] Check if finite number` }
];

export const globalFunctionsHelp = [
    { name: 'Object.keys(obj)', content: `[b]Description:[/b] Get object keys as array` },
    { name: 'Object.values(obj)', content: `[b]Description:[/b] Get object values as array` },
    { name: 'Object.assign(target, src)', content: `[b]Description:[/b] Copy properties to target` },
    { name: 'Object.entries(obj)', content: `[b]Description:[/b] Get [key, value] pairs` },
    { name: 'Object.hasOwnProperty(key)', content: `[b]Description:[/b] Check if property exists` },
    { name: 'Date.now()', content: `[b]Description:[/b] Current timestamp (milliseconds)` },
    { name: 'new Date()', content: `[b]Description:[/b] Create date object` },
    { name: 'new Date(timestamp)', content: `[b]Description:[/b] Create date from timestamp` },
    { name: 'parseInt(str)', content: `[b]Description:[/b] Parse string to integer` },
    { name: 'parseFloat(str)', content: `[b]Description:[/b] Parse string to float` },
    { name: 'isNaN(x)', content: `[b]Description:[/b] Check if not a number` },
    { name: 'isFinite(x)', content: `[b]Description:[/b] Check if finite number` },
    { name: 'encodeURIComponent(str)', content: `[b]Description:[/b] Encode URI component` },
    { name: 'decodeURIComponent(str)', content: `[b]Description:[/b] Decode URI component` },
    { name: 'String(x)', content: `[b]Description:[/b] Convert to string` },
    { name: 'Number(x)', content: `[b]Description:[/b] Convert to number` },
    { name: 'Boolean(x)', content: `[b]Description:[/b] Convert to boolean` },
    { name: 'Array.isArray(x)', content: `[b]Description:[/b] Check if is array` }
];

export const arrayConstructorHelp = [
    { name: 'new Array()', content: `[b]Description:[/b] Create empty array` },
    { name: 'new Array(n)', content: `[b]Description:[/b] Create array with n elements` },
    { name: 'new Array(a, b, c)', content: `[b]Description:[/b] Create array with elements` },
    { name: '[1, 2, 3]', content: `[b]Description:[/b] Array literal syntax` },
    { name: 'Array.from(obj)', content: `[b]Description:[/b] Create array from iterable` },
    { name: 'Array.of(...args)', content: `[b]Description:[/b] Create array from arguments` }
];

export const stringNumberConstructorsHelp = [
    { name: 'new String(str)', content: `[b]Description:[/b] Create string object` },
    { name: '"text" or \'text\'', content: `[b]Description:[/b] String literal` },
    { name: 'template literal', content: `[b]Description:[/b] Template literal syntax using backticks` },
    { name: 'new Number(n)', content: `[b]Description:[/b] Create number object` },
    { name: '123 or 12.34', content: `[b]Description:[/b] Number literal` },
    { name: '0x123', content: `[b]Description:[/b] Hexadecimal literal` }
];
