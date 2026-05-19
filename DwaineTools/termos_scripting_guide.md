# TermOS (DWAINE) Scripting Guide

TermOS (also known as the DWAINE OS) features a built-in shell (`Msh`) that allows users to write scripts for automating tasks, executing commands, and manipulating data. DWAINE shell scripts use a mix of standard shell paradigms and a Forth-like, stack-based Reverse Polish Notation (RPN) system for evaluating expressions.

## 1. Script Structure & Basics
- **Shebang**: All DWAINE shell scripts must begin with `#!` on the very first line. Without this, the shell will not recognize the file as a script.
- **Comments**: Any line beginning with `#` (after optional leading whitespace) is considered a comment and ignored.
- **Command Piping**: You can pipe the output of one command to another using `^` (the pipe operator). Under the hood, this uses an internal temporary stream.
- **Command Substitution**: You can evaluate a command and substitute its output into another command by wrapping it in `$(...)`. E.g., `echo Today is $(date)`.
- **Output Redirection**: You can pipe the output of a command stream directly into a file by providing a file path at the end of a pipe chain. E.g., `echo Data ^ /home/usr/data`
  - **Multiple File Deployment**: To create multiple *unique* files on a single line, you cannot use `echo` (as `echo` appends to the internal pipe stream, merging your outputs). Instead, use the `eval` trick to overwrite the pipe stream:
    `eval 'hello 1' to tmp ^ eval tmp ^ file1 ^ eval 'hello 2' to tmp ^ eval tmp ^ file2`
## 2. Variables
Variables in DWAINE are untyped and scoped to the script iteration.
- **Retrieving**: To get the value of a variable, prefix its name with a dollar sign: `$var_name`.
- **Assigning**: Variables are typically assigned using the `to` or `value` RPN operators (see *Stack Evaluation* below).
- **Clearing**: You can use the `unset` built-in command to clear variables. Passing specific names clears them (`unset var1 var2`), while passing no arguments (`unset`) instantly clears **all** variables.

### Built-in Special Variables
When a script is executed, the shell automatically populates the following variables:
- `$`: The Process ID (progid) of the current running script.
- `su`: Evaluates to `1` if the user executing the script has administrative privileges (group `0`), otherwise `0`.
- `*`: A single string containing all arguments passed to the script, joined by spaces.
- `argc`: The total number of arguments passed to the script.
- `arg0`, `arg1`, `arg2`, etc.: The individual arguments passed to the script (`arg0` is the first argument).

## 3. Control Flow (Single-Line Piped Execution)
Unlike Unix shells, DWAINE provides highly simplified built-in commands for branching and loops. Control flow heavily relies on the stack evaluator, and **crucially, conditional blocks and loops must be contained entirely on a single line separated by pipes `^`**.

- **`if`**: Evaluates an RPN expression. If the result is truthy, the script executes the commands piped *after* the `if` and *before* an `else`. If falsy, it executes commands piped *after* the `else`.
  Example: `eval $arg0 5 gt ^ if ^ echo Greater than 5 ^ else ^ echo Less than or equal to 5`
- **`while`**: Evaluates an RPN expression and continues to loop over the rest of the piped commands on that single line as long as the expression evaluates to truthy. The shell re-evaluates the entire line each iteration.
  Example: `eval $count 0 gt ^ while ^ echo $count... ^ eval $count 1 - to count ^ sleep 1`
- **`break`**: Instantly terminates the script entirely. (Note: This does not just break out of a loop, it halts the script process).
- **`sleep`**: Suspends script execution for a specified amount of time.

## 4. Stack Evaluation (RPN)
Expressions in `if`, `while`, and `eval` commands use a stack-based **Reverse Polish Notation (RPN)** syntax. 
Operands (numbers, variables, strings) are pushed onto a stack. Operators pop operands from the stack, compute a result, and push the result back onto the stack.
*Example: `eval 5 3 +` pushes `5`, pushes `3`, pops both for the `+` operator, and pushes `8`.*

**Note on Variables in RPN**: Inside `eval`, `if`, or `while`, you can refer to variables directly by name without the `$` prefix (e.g., `eval count 0 gt`), as the stack evaluator can fetch them from memory. Alternatively, using the `$` prefix (e.g., `eval $count 0 gt`) will cause the shell to substitute the value before evaluating.

### Arithmetic Operators
- `+` : Adds the top two values.
- `-` : Subtracts the top value from the second-top value.
- `*` : Multiplies the top two values.
- `/` : Divides the second-top value by the top value.
- `%` : Computes the modulo of the second-top value by the top value.
- `rand` : Generates a random number.

### Relational Operators
These operators return `1` for true and `0` for false.
- `eq` : Equal to (`==`)
- `ne` : Not equal to (`!=`)
- `lt` : Less than (`<`)
- `le` : Less than or equal to (`<=`)
- `gt` : Greater than (`>`)
- `ge` : Greater than or equal to (`>=`)

### Logic Operators
- `and` : Logical AND
- `or` : Logical OR
- `not` or `!` : Logical NOT (inverts the truthiness of the top value)
- `xor` or `eor` : Logical XOR

### Stack & Variable Manipulation Operators
- `to` or `value` : Pops the top value and assigns it to the variable named by the next token. (e.g., `eval 10 to my_var`)
- `'` (apostrophe) : Slurps all subsequent tokens until the next apostrophe and pushes them as a single string. (e.g., `eval ' This is a sentence '`)
- `dup` : Duplicates the top value on the stack.
- `del` : Deletes (pops) the top value from the stack without printing.
- `.` (dot) : Pops the top value from the stack.
- `.s` : Prints the current contents of the stack.
- `#` : Pushes the current depth (number of items) of the stack onto the stack.

### File Verification Operators
These operators pop a string (path) and return `1` if the condition is true, `0` otherwise.
- `e` : Checks if the path exists.
- `f` : Checks if the path is a valid file.
- `d` : Checks if the path is a valid directory.
- `x` : Checks if the path points to an executable program.

## 5. Built-in Commands
The shell natively supports several commands that run without needing an external executable in `/bin`.
- **`echo [text]`**: Outputs the text to the screen, or passes it down the pipe stream.
- **`eval [expression]`**: Parses its arguments as an RPN expression and pushes the result to the stack.
- **`cls`** or **`clear`**: Clears the terminal screen.
- **`man [topic]`** or **`help`**: Displays the manual or help page for a given topic.
- **`who`**: Lists the IDs and names of all users currently logged into the network.
- **`mesg [y/n]`**: Allows (`y`) or disallows (`n`) incoming messages from other users.
- **`talk [target_id] [message]`**: Sends a direct message to another user or terminal ID on the network.
- **`goonsay [text]`**: Prints an ASCII art clown saying your text.
- **`logout`** or **`logoff`**: Immediately logs you out of the DWAINE terminal and halts your script entirely.
- *Note: `unset`, `if`, `else`, `while`, `break`, and `sleep` are also built-ins, but have been discussed in previous sections.*

## 6. Example Script
```bash
#!
# Example: Count down from a given argument or 5 if no argument is provided
# Notice how control flow (if/else and while) is contained on a single line using pipes.

eval argc 0 eq ^ if ^ eval 5 to count ^ else ^ eval arg0 to count

echo Starting countdown from $count...

eval count 0 gt ^ while ^ echo $count... ^ eval count 1 - to count ^ sleep 1

echo Blastoff!
```

## 7. Known Quirks and Bugs
The TermOS shell parser makes several shortcuts that lead to unexpected behaviors. Watch out for these when scripting:

- **`eval` Won't Pipe Math Results Directly**: The `eval` built-in only pushes data to the pipe stream if its command has exactly one token. `eval 5 3 + ^ echo` will pass an empty string because there are 3 tokens! To pipe a math result, you must assign it to a variable first: `eval 5 3 + to tmp ^ eval tmp ^ echo`.
- **Strict Variable Interpolation**: The parser identifies variables to substitute by looking at the *exact space-separated token*. A token like `$count...` fails to substitute because it looks for the literal variable `count...`. You cannot mix variables and punctuation without spaces. **Workaround**: Use spaces (`$count ...`) or the stack evaluator's string concatenation (`eval count '...' + ^ echo`).
- **Interactive Variable Persistence (The Script-Writing Bug)**: If you are creating a script via the interactive prompt using `echo` (e.g. `echo eval $count 1 + to count ^ my_script`), the shell evaluates `$count` *before* creating the file! If `$count` is currently defined in your interactive session, it will write its current value (e.g. `eval 5 1 + to count`) into the script instead of the literal text `$count`. **Workaround**: You must run `unset count` or `unset` (to clear all variables) before generating scripts that reference those variables.
- **HTML Tags are Erased**: The shell strips HTML-like tags (`<...>`) from every script line prior to execution. Trying to `echo <test>` will silently erase the `<test>`. This is why mathematical operators use `lt` and `gt` instead of `<` and `>`.
- **Unclosed Quotes Cause Infinite-Like Duplication**: Leaving a quote unclosed (e.g. `echo "hello world`) confuses the parser's index pointer, causing it to repeatedly evaluate trailing substrings. This duplicates tokens and mangles execution instead of throwing a syntax error.
- **Spaces Inside Apostrophe Operators Corrupt Stack**: When using the `'` slurp operator, do **not** put spaces adjacent to the quotes (e.g., `' hello '`). Doing so triggers a tokenizing bug that injects invisible empty strings into the token stream. Since empty strings are falsy, they cause variables to fail lookup and push raw variable names to the stack instead of values. Always format as `'hello'`.
- **File Extensions Are Not Allowed**: The file system's `is_name_invalid` filter uses a sanitizer that completely strips periods (`.`). This means trying to create `file.txt` will result in the sanitizer comparing `filetxt` to `file.txt` and throwing an "Unable to pipe stream to file" error. Never use extensions in DWAINE filenames.
- **Command Substitution fails inside Quotes**: Unlike Unix where `"$(who)"` runs the command and quotes the output, the TermOS parser entirely skips evaluating `$(...)` if it occurs inside double quotes.
- **Re-entrancy Fork Bomb on Sleeping Scripts**: If a script invokes another script (e.g., `get` calling `set`), and the child script executes a hardware command that sleeps (such as `teleman` calling `s_telepad` which sleeps for 0.6 seconds), BYOND's machinery loop will continue ticking every 0.1 seconds. Because `process()` calls `script_process()` on sleeping shells without verifying if a child process is blocking, the sleeping parent shell will repeatedly re-execute the spawning line every decisecond. This causes a massive fork bomb that floods the virtual hard drive (`src.runfolder`) with process copies until the disk fills up, resulting in `Break at line` errors. **Workaround**: Scripts must perform their own standalone calculations (`eval ... to tx / ty`) rather than calling external helper scripts, flattening the process tree to avoid re-entrancy during hardware sleeps. Verify that generated scripts do not depend on external helper scripts.
- **Hardware Driver Mountpoint Deletion Leak (`rm -r /mnt/radio/...`)**: When using `rm` (which invokes `DWAINE_COMMAND_FKILL`) on a directory managed by a mountable hardware driver (like `pr6_radio`), the driver's `remove_file()` proc removes the folder from the virtual filesystem mirror (`contents_mirror`) but **does not call `dispose()` or `qdel()` on the folder object**. If a script repeatedly deletes and recreates driver folders in a loop (e.g., `rm -r /mnt/radio/1149 ^ mkdir /mnt/radio/1149`), the undisposed folder objects leak in memory, and the rapid recreation desynchronizes the mainframe's file hierarchy. This corrupts directory traversal, causing subsequent `ls` commands in the user's terminal to fail or error out. **Workaround**: Never delete driver mountpoint folders (e.g. `/mnt/radio/1149`). Instead, use `rm` or `fkill` directly on the individual packet `record` files inside the channel folder once they have been read.
- **`fkill` Subfolder Reference Leak on Driver Mountpoints**: When deleting an individual packet record file inside a driver subfolder (e.g., `rm /mnt/radio/1149/AB123456`), `fkill` checks if `target_file.holding_folder` is a mountable driver. Because `holding_folder` is `/datum/computer/folder/radio_channel` (a folder, not the driver itself), `fkill` bypasses `holding_folder.remove_file()` and directly calls `target_file.dispose()`. However, `/datum/computer/file/record` does not override `disposing()` to remove itself from `holding_folder.contents`. As a result, the qdeleted packet object remains in `rc.contents`. Over time, `rc.contents` accumulates qdeleted object references forever, even when `pr6_radio`'s 32-packet capping logic (`qdel(rc.contents[1])`) runs.
- **`mkdir` Hardware Spam & Nesting Bug**: Every time `mkdir /mnt/radio/1149` successfully adds a folder to `pr6_radio`, the driver broadcasts `_command=add&_freq=1149` over the network to the physical radio peripheral hardware, spamming the device buffer. Furthermore, if `mkdir /mnt/radio/1149` is executed when `/mnt/radio/1149` already exists (e.g. if `rm -r` didn't run or failed), `FWRITE` resolves the destination to the existing `/mnt/radio/1149` folder itself, creating a corrupted nested directory structure `/mnt/radio/1149/1149`.
- **Built-in Driver Packet Capping & Grep Repetition**: `pr6_radio` automatically caps channel folders at 32 packets (`if (length(rc.contents) > 32) qdel(rc.contents[1])`). However, because `grep -r -i message /mnt/radio/1149` matches all existing packets in the folder, failing to clear or track read packets causes `grep` to repeatedly match and print the exact same message every 2 seconds forever.
- **`rm` Limitations & Command Substitution Header Trap**: `rm` does not support wildcards (`rm /mnt/radio/1149/*`) or multiple file arguments in a single string. Furthermore, `rm $(ls /mnt/radio/1149)` fails because `ls` prepends a header (`Contents of /mnt/radio/1149|n`), which `rm` attempts to parse as part of a single literal filepath string.
- **Empty Command List Trap in `if $(...)` Loops**: When using command substitution inside an `if` statement (e.g., `if $(grep -r -i message /mnt/radio/1149)`), if the inner command returns no output (e.g. `grep` finds no matching packets), the outer command evaluates to `if ""` (an empty command list). In DWAINE's `if` builtin logic (`if.dm`), an empty command list triggers `BUILTIN_BREAK`, which causes the shell's `script_process()` to output `Break at line 1` and immediately terminate the entire script process. **Workaround**: Ensure that looping packet checkers do not rely on a bare `if $(grep ...)` condition that can evaluate to empty.
- **Double Piping File Creation Flaw (`^ file ^ file`)**: During script deployment or piping, if a filename appears multiple times at the end of a pipe chain (e.g. `eval 'code' to _t ^ eval _t ^ pdatest ^ pdatest`), the shell treats the file purely as an output destination both times. The first pipe creates the file with the buffer contents, and the second pipe triggers `FWRITE`'s append logic, which combines the old and new fields, deletes the old record object, and creates a duplicate-content record. It does **not** execute the file on the second pipe. **Workaround**: To execute a script after creating it, use a separate command line or ensure the script execution command is not prefixed by a pipe operator.
- **`while` Loop `continue` Line Repetition**: In `shell.dm`, when a line containing a `while` loop finishes executing, the shell checks the `SCRIPT_IN_LOOP` flag. If set, it unsets the flag and executes `continue` without advancing the script line pointer or cutting the current line from `shscript`. This causes the entire single line (including any trailing commands piped after the `while` block) to re-execute repeatedly up to 5 times per mainframe processing cycle.
- **Absolute Path Requirement for File Operators (`e`, `f`, `d`, `x`)**: The internal `DWAINE_COMMAND_FGET` syscall used by file verification operators (`e`, `f`, `d`, `x`) delegates to `parse_datum_directory` using `src.kernel.holder.root` as the origin. Consequently, `FGET` completely ignores the caller program's current working directory (`curpath`) and evaluates all relative paths as relative to root (`/`). E.g., `'/mnt/radio/1149' e` works because it is absolute, but `'AB123456' e` checks `/AB123456` rather than looking in the current directory. **Workaround**: Always pass fully qualified absolute paths to file verification operators.
