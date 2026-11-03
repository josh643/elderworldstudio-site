---
seo_title: "Devlog: Building a Living Medieval World for Omnivael | Elder World Studio"
meta_description: "An Elder World Studio devlog on building Omnivael's medieval frontier: a living sandbox RPG where trade, people, and time shape the world, not a chosen one."
slug: devlog-building-a-medieval-world
status: published
suggested_internal_links:
  - text: "Our games"
    url: /games/
  - text: "Omnivael: Wayfarer's Life on Steam"
    url: https://store.steampowered.com/app/4121760/
  - text: "Chronicles of the Realm on Steam"
    url: https://store.steampowered.com/app/2559510/
  - text: "Medieval Village Props asset pack"
    url: /products/medieval-village-props/
  - text: "Become a tester"
    url: /testers/
---

# Devlog: Building a Living Medieval World

Elder World Studio started in Memphis making games, and games are still the heart of what we do. Our biggest project is **Omnivael: Wayfarer's Life**, a living sandbox RPG set on a medieval frontier, headed to Steam Early Access. This devlog is about the thinking behind that world: why we built it the way we did, and what we've learned about making a medieval setting feel *lived in* instead of staged.

## No chosen one. No war to win.

Most fantasy RPGs hand you a destiny. You're the prophesied hero, there's a dark lord, and the world exists to wait for you to save it. We wanted the opposite.

Our tagline for Omnivael is simple: *"No Chosen One. No war to win. Just a world to live in."* Your legacy unfolds through trade, exploration, relationships, and time itself. You're one wayfarer among many, and the frontier would keep turning without you.

That one design decision changes everything downstream. If the player isn't the center of the world, the world needs its own reasons to exist.

## An economy that runs on its people

The core idea of Omnivael is a medieval frontier whose economy runs on its people. Goods don't just appear in shops; they come from somewhere and go somewhere. That gives every location a job:

- **Farms** grow the food that ends up in the market.
- **Smithies** turn ore and ingots into tools.
- **Taverns** are where travelers rest, talk, and spend.
- **Markets** are where it all meets, and where a sharp trader can make a living.

When we design a village, we start from that question: what does this place make, and what does it need? A village that only makes sense as scenery feels hollow. A village with a reason to exist feels real, even before you talk to anyone.

## Making props tell the story

A medieval world is built as much from small objects as from big buildings. Barrels, crates, baskets, bread, bottles, tools, ingots, and timber stacks do a surprising amount of storytelling. A smithy with ore piles and half-worked ingots tells you the forge is busy. A tavern with bottles at different fill levels tells you someone was just drinking.

We built a large library of village and market props for this, organized by the same categories we design around: containers, farm, food, goods, ingots, ores, smithy, storage, tavern, and timber. A few details turned out to matter more than we expected:

- **Fill levels.** Open crates with different contents, barrels with adjustable liquid, and bottles and vials with fill levels let one prop say many different things.
- **Real-world scale.** When every prop is built to real scale, scenes come together quickly and nothing looks oddly giant or tiny next to the player.
- **Consistent materials.** Keeping a consistent texture approach across the whole set keeps a market stall from looking like it was assembled from five different games.

Our pipeline mixes procedural modeling in Blender with AI-assisted mesh generation, and every AI-assisted mesh gets cleaned, retopologized, re-textured, and checked by hand. The tools help us move faster; the hand pass is what makes the result usable.

We liked the results enough that we packaged them up for other developers as **[Medieval Village Props](/products/medieval-village-props/)**. More on that in [its own post](/blog/medieval-village-props-unity-asset-pack/).

## Time as a mechanic

"Time itself" is in Omnivael's description for a reason. In a world built around a life rather than a quest, time is what gives your choices weight. Relationships grow over time. Legacy is what's left after time passes.

Designing for time means thinking about what changes in a place as the hours pass. Here's what's in place in our current development builds:

- **A world clock.** By default, one in-game day lasts 24 real minutes, so one real minute is one game hour. The clock pauses with the game and is stored in your save, so the day and hour pick up where you left off.
- **A full day/night cycle.** The sun moves across the sky, a dim blue moon takes over at night, and light colour, ambient light, and fog all shift with the hour. After dark, your character carries a lantern.
- **Villagers with daily schedules.** Townsfolk follow schedules built from simple time blocks: sleep, work, eat, the tavern, the market, or a wander through town. They walk between homes, workplaces, the market, the well, and the tavern yard, head indoors when their schedule says so, and come back out the same door. If you stop to talk to someone, they stay put until you're done.

In practice, the same village plays differently at 7:30 in the morning, at midday, at dusk, and close to midnight. The town keeps moving through its day whether you're watching or not, and that's the frontier we want you to live in.

## A smaller window into the same world

Not every Omnivael experience has to be a sprawling sandbox. **[Chronicles of the Realm](https://store.steampowered.com/app/2559510/)** is a free first-person dungeon game set in the world of Omnivael, also coming to Steam. You take up sword and shield, survive wave after wave of slimes and goblins in a torch-lit cave, and pick a boon between waves.

It's a tighter, action-focused slice of the same setting, and a good way for us to test how the world's look and feel hold up in fast combat.

## What we've learned so far

A few lessons from building a medieval world as a small indie studio:

1. **Start from purpose, not scenery.** Ask what a place does before you decide what it looks like.
2. **Small props carry big stories.** Spend time on the clutter. It's what players actually look at up close.
3. **Build reusable libraries.** A well-organized prop set pays off across every village, every game, and even other studios' projects.
4. **Use new tools, but keep a human pass.** AI and procedural tools speed up production; hand cleanup is what makes assets shippable.
5. **Let the world not need you.** The less the world revolves around the player, the more the player wants to be part of it.

## Follow along

Omnivael: Wayfarer's Life is coming to Steam Early Access. **[Wishlist it on Steam](https://store.steampowered.com/app/4121760/)**, check out **[all our games](/games/)**, and if you want to get your hands on builds early, **[sign up as a tester](/testers/)**.

More devlogs to come as we get closer to launch.
