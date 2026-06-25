---
name: calculator
version: 1.0.0
description: "Perform basic arithmetic operations (add, subtract, multiply, divide)."
metadata:
  category: utility
  icon: calculator
  tags:
    - math
    - arithmetic
    - calculator
---

# calculator

Perform basic arithmetic operations.

## Usage

```bash
calculator --operation <OP> --a <NUMBER> --b <NUMBER>
```

## Operations

- `add` - Addition
- `subtract` - Subtraction
- `multiply` - Multiplication
- `divide` - Division

## Flags

| Flag | Required | Type | Description |
|------|----------|------|-------------|
| `--operation` | ✓ | string | Operation to perform (add/subtract/multiply/divide) |
| `--a` | ✓ | number | First number |
| `--b` | ✓ | number | Second number |

## Examples

```bash
# Addition
calculator --operation add --a 123 --b 456

# Division
calculator --operation divide --a 100 --b 5
```

## Error Handling

- Returns error if operation is not recognized
- Returns error if dividing by zero
