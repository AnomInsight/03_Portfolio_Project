import json
import csv
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
MENU_JSON = _PROJECT_ROOT / "data" / "menu-data.json"
MENU_CSV = _PROJECT_ROOT / "data" / "menu-data.csv"

EXTRA_INGREDIENT_PRICE = 1.00


def load_menu():
    if not MENU_JSON.exists():
        raise RuntimeError(f"Missing menu data file: {MENU_JSON}")

    try:
        with open(MENU_JSON, "r", encoding="utf-8") as f:
            menu_data = json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        raise RuntimeError(f"Could not load menu data from {MENU_JSON}") from exc

    if not isinstance(menu_data, dict) or "ingredients" not in menu_data or "pizzas" not in menu_data:
        raise RuntimeError(f"Invalid menu data format in {MENU_JSON}")

    return menu_data


def save_menu(menu_data):
    with open(MENU_JSON, "w", encoding="utf-8") as f:
        json.dump(menu_data, f, indent=4)

def export_menu_to_csv():
    menu_data = load_menu()
    with open(MENU_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "ingredients", "price"])
        for pizza in menu_data["pizzas"]:
            writer.writerow([pizza["name"], ", ".join(pizza["ingredients"]), pizza["price"]])
    print(f"Menu exported to {MENU_CSV}")
    
def add_ingredient(ingredient):
    menu_data = load_menu()
    if ingredient not in menu_data["ingredients"]:
        menu_data["ingredients"].append(ingredient)
        save_menu(menu_data)
        print(f"Ingredient '{ingredient}' added to the menu.")
    else:
        print(f"Ingredient '{ingredient}' already exists in the menu.")

def add_pizza(name, ingredients, price):
    menu_data = load_menu()
    if any(pizza["name"].lower() == name.lower() for pizza in menu_data["pizzas"]):
        print(f"Pizza '{name}' already exists in the menu.")
        return
    
    for ingredient in ingredients:
        if ingredient not in menu_data["ingredients"]:
            print(f"Ingredient '{ingredient}' does not exist in the menu. Please add it first.")
            return
    
    new_pizza = {
        "name": name,
        "ingredients": ingredients,
        "price": price
    }
    menu_data["pizzas"].append(new_pizza)
    save_menu(menu_data)
    print(f"Pizza '{name}' added to the menu.")
    
def choose_from_numbered_list(options, allow_empty=False, allow_multi=False):
    for i, option in enumerate(options, start=1):
        print(f"{i}. {option}")

    while True:
        choice = input("Choose number(s): ").strip()

        if allow_empty and choice == "":
            return [] if allow_multi else None

        if allow_multi:
            parts = [p.strip() for p in choice.split(",") if p.strip()]
            if parts and all(p.isdigit() for p in parts):
                indexes = [int(p) - 1 for p in parts]
                if all(0 <= idx < len(options) for idx in indexes):
                    return indexes

        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return int(choice) - 1

        print("Invalid choice. Please try again.")

def create_order(menu_data):
    order = []
    while True:
        print("\n=== Create Order ===")
        pizza_names = [pizza["name"] for pizza in menu_data["pizzas"]]
        pizza_names.append("Finish order")
        choice_index = choose_from_numbered_list(pizza_names)
        
        if choice_index == len(pizza_names) - 1:
            break
        
        selected_pizza = menu_data["pizzas"][choice_index]

        print(f"\nBase ingredients for {selected_pizza['name']}: {', '.join(selected_pizza['ingredients'])}")
        print("Choose extra ingredients (comma-separated numbers), or press Enter for none (each extra $1.00):")
        extra_indexes = choose_from_numbered_list(
            menu_data["ingredients"],
            allow_empty=True,
            allow_multi=True,
        )
        extras = [menu_data["ingredients"][i] for i in sorted(set(extra_indexes))]

        extra_cost = len(extras) * EXTRA_INGREDIENT_PRICE
        item_total = round(selected_pizza["price"] + extra_cost, 2)

        order_item = {
            "name": selected_pizza["name"],
            "base_ingredients": selected_pizza["ingredients"],
            "extra_ingredients": extras,
            "base_price": selected_pizza["price"],
            "extra_cost": round(extra_cost, 2),
            "total_price": item_total,
        }
        order.append(order_item)
        print(
            f"Added '{order_item['name']}' with {len(extras)} extra(s). "
            f"Item total: ${order_item['total_price']:.2f}"
        )
    
    if order:
        total_price = sum(item["total_price"] for item in order)
        print("\n=== Order Summary ===")
        for item in order:
            print(f"{item['name']} - ${item['total_price']:.2f}")
            print(f"  Base: ${item['base_price']:.2f}")
            print(f"  Extras: {', '.join(item['extra_ingredients']) if item['extra_ingredients'] else 'none'}")
            print(f"  Extra cost: ${item['extra_cost']:.2f}")
        print(f"Total Price: ${total_price:.2f}")
    else:
        print("No pizzas were added to the order.")

def main():
    menu = load_menu()

    while True:
        print("\n=== Pizza Menu System ===")
        print("1. List menu")
        print("2. Add ingredient")
        print("3. Add pizza")
        print("4. Create order")
        print("5. Export CSV")
        print("0. Exit")
        
        cmd = input("Choose: ").strip()
        
        if cmd == "1":
            print("\n=== Menu ===")
            for pizza in menu["pizzas"]:
                print(f"{pizza['name']} - ${pizza['price']:.2f}")
                print(f"  Ingredients: {', '.join(pizza['ingredients'])}")
                
        elif cmd == "2":
            ingredient = input("Enter ingredient name: ").strip()
            add_ingredient(ingredient)
            menu = load_menu()

        elif cmd == "3":
            name = input("Enter pizza name: ").strip()
            ingredients = input("Enter ingredients (comma separated): ").strip().split(",")
            ingredients = [i.strip() for i in ingredients]
            price = float(input("Enter price: ").strip())
            add_pizza(name, ingredients, price)
            menu = load_menu()
            
        elif cmd == "4":
            create_order(menu)
            
        elif cmd == "5":
            export_menu_to_csv()
            
        elif cmd == "0":
            break
        
        else:
            print("Invalid choice. Please try again.")
            
if __name__ == "__main__":
    main()