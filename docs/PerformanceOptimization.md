Here are the same five findings, in plain language.

## 1. Everything on screen redraws whenever anything changes

**What's happening:** the app keeps all its data in one big shared box: your transactions, your accounts, your settings, your streak, everything. Every screen watches that whole box. So when any single thing in it changes, every part of the screen you're looking at gets rebuilt from scratch, even the parts that had nothing to do with the change.

**Scenario:** You're on the Home screen. You go into Settings and flip the "sound" toggle off. That toggle has nothing to do with your spending, but flipping it causes Pip, your pie chart, your budget bars, your net worth number, and your streak ring to all get thrown away and redrawn. You won't see it flicker, but the phone did the work, and on a cheaper Android phone that's a visible stutter.

**The fix:** separate the box into "things that change often" (your transactions) and "things that basically never change" (the save and delete buttons' wiring). Screens that only use the second kind stop reacting to the first kind.

## 2. The All Transactions screen builds every single row, even the ones off screen

**What's happening:** when you open your transaction list, the app builds every row at once. Not just the ten you can see, but all of them. It also does this again from scratch on every letter you type into the search bar.

**Scenario:** You imported two years of bank history, so you have about 3,000 transactions. You open All Transactions and it hangs for a moment before appearing, because the phone just built 3,000 rows with 3,000 little category icons. Then you tap the search bar and type "grab". By the time you've typed the fourth letter, the app has filtered and re-sorted all 3,000 transactions four separate times and rebuilt the entire list four times. The keyboard feels laggy and letters appear a beat after you press them.

**The fix:** only build the rows that are actually visible, and build more as you scroll (this is standard, the Calendar screen already does it). Plus wait until you've stopped typing for a fraction of a second before running the search, instead of running it on every keystroke.

## 3. The net worth history chart gets slower every month you use the app

**What's happening:** to draw the history chart, the app works out what each account was worth at the end of each month. But for every single month, for every single account, it re-sorts that account's entire history from the beginning. It's like re-alphabetising a filing cabinet before pulling out each individual file, then putting it back out of order, then re-alphabetising it again for the next file.

**Scenario:** You've used the app for three years and you track ten investment holdings. The app has been quietly saving a value for each holding every day, so that's about 11,000 saved readings. When you open Net Worth History, it now has to do that sort-and-search roughly 500 times over. The screen takes a noticeable moment to appear. A user who's been on the app one month sees it appear instantly, so this gets worse the longer someone stays, which is exactly the wrong direction.

**The fix:** sort the history once at the start, then walk through it in order. Same answer, a fraction of the work. Also cap the chart at two years by default instead of letting it stretch back forever.

## 4. The budget progress bars are animated the expensive way

**What's happening:** those bars that fill up to show how much of each budget you've spent are animated by repeatedly re-measuring and re-laying-out the bar, sixty times a second, using the slower of the two ways the phone can animate things.

**Scenario:** You open the Budget screen with eight categories set up. All eight bars animate in at once. Each one is asking the phone to recalculate its size sixty times a second, so that's 480 layout recalculations per second, all on the same thread that handles your scrolling and tapping. The bars fill in slightly janky, and if you try to scroll while they're still animating, the scroll stutters.

**The fix:** there's a second way to animate that runs on a separate part of the phone and doesn't fight with your scrolling. It requires stretching the bar rather than resizing it, which looks identical but is dramatically cheaper.

## 5. Editing one transaction reloads all of them

**What's happening:** any time you save, edit, or delete a transaction, the app throws away its entire in-memory copy of your ledger and reads all of it back out of the database. Then it recalculates your streak, your data coverage, your outstanding debts, and updates the home screen widget.

**Scenario:** You're tidying up. You open a transaction and fix a typo in the note, just changing "Starbuck" to "Starbucks". Saving that one-word edit causes the app to re-read all 3,000 of your transactions from the database, recount your logging streak from scratch, recalculate who still owes you money, and push an update to your Android home screen widget. You do this on five transactions in a row and each save feels slightly sluggish.

**The fix:** when you edit one row, just update that one row in memory. The app already knows exactly what changed, it just isn't using that knowledge.

---

**Where I'd start:** #2, the transaction list. It's contained to one file, and it's the place where a real user with real data will actually feel the app struggle. #3 is a close second because it quietly punishes your longest-standing users.

Want me to fix any of these?