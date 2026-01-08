You must follow these LSL rules exactly. Do NOT deviate from them.

===========================================================
1. LSL LANGUAGE RESTRICTIONS (MANDATORY)
===========================================================

- Do NOT use ternary operators. LSL does NOT support them.
  (No: condition ? a : b)

- Do NOT use "break;" or "continue;" inside loops.
  LSL does NOT support them.

- Do NOT use reserved words as variable names.
  Examples of forbidden names:
  state, default, jump, return, key, list, vector, rotation, integer, float, string, event, touch, link, timer, listen, changed, on_rez, attach, collision, sensor, no_sensor, if, else, for, while, do, switch, case.

- Do NOT use "void" as a return type.
  LSL functions must be:
    - return <type>
    - or return nothing (default is no return type)

- Do NOT place function definitions inside the default state.
  All functions MUST be defined ABOVE the default state.

- Do NOT define functions inside other functions.
  LSL does NOT support nested functions.

- Do NOT use multi-line function signatures.
  LSL requires single-line function declarations.

===========================================================
2. LSL STRUCTURE RULES
===========================================================

- LSL uses the potential for multiple states. However, do
  not use additional states without asking first.

- The script MUST follow this structure:
    // global variables
    // function definitions
    default
    {
        state_entry() { ... }
        touch_start(integer n) { ... }
        link_message(integer s, integer n, string m, key id) { ... }
        // other events as needed
    }

- Do NOT reorder the script into multiple states.
- Do NOT move functions below the default state.
- Do NOT wrap functions inside events.

===========================================================
3. LSL CONTROL FLOW RULES
===========================================================

- Do NOT use recursion.
- Do NOT use goto or jump.
- Do NOT use switch/case.
- Do NOT use try/catch (LSL does not support exceptions).
- Do NOT use "return" outside of a function.

===========================================================
4. LSL VARIABLE RULES
===========================================================

- All variables must have explicit types.
- Do NOT infer types.
- Do NOT use "var" or "auto".
- Do NOT shadow variables.
- Do NOT reuse variable names across scopes if avoidable.

===========================================================
5. LSL COMPATIBILITY RULES
===========================================================

- Do NOT use unsupported operators:
    += on lists
    -= on lists
    *= on lists
    /= on lists
    % on floats
    ++ or -- on vectors or rotations

- Do NOT use JSON functions unless explicitly instructed.
- Do NOT use llList2Json or llJson2List unless explicitly instructed.

===========================================================
6. LSL LOOP RULES
===========================================================

- Loops must be simple and safe.
- Integers for indexing must be declared before the FOR
  Loop is declared.
- Do NOT create infinite loops.
- Do NOT create loops without a clear exit condition.
- Do NOT use break or continue.

===========================================================
7. LSL EVENT RULES
===========================================================

- Allowed events:
    state_entry
    touch_start
    link_message
    timer
    listen
    changed
    on_rez
    attach

- Do NOT add sensor, collision, or pathfinding events unless instructed.

===========================================================
8. MODIFICATION RULES
===========================================================

- Modify ONLY the script requested.
- Do NOT refactor unrelated code.
- Do NOT rename variables unless explicitly instructed.
- Do NOT reorder logic unless explicitly instructed.
- Do NOT add new features unless explicitly instructed.

===========================================================
END OF LSL RULES
===========================================================