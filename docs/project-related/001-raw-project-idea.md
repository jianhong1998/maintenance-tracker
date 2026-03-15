# Maintenance Tracker

## Problem Statement

People that owning vehicle wanted to keep track on their vehicle maintenance. For example, for a motorbike (scooter), owner have to do CVT cleaning for every 6,000 km. But without a proper tracking, owner cannot remember when to do the maintenance.

## As-Is workflow

Vehicle owners are using notebook to write down the maintanence record and when to do the next maintanence for certain parts / tasks.

### Painpoint

Hard to know still left how many mileage to reach the next maintenance.

## To-Be workflow

1. Vehicle owners login to the maintenance tracker app.
2. Update current mileage.
3. View the maintenance dashboard for all the maintenance cards and the remaining mileage before have to execute the maintenance.

## Basic Functional Requirements

### User behaviours

1. User should be able to login with gmail.

2. User should be able to update their vehicle info (brand, model, colour, current mileage in `km` or `mile`).
   - Each user can only see his/her vehicles.

3. User should be able to add, edit, delete the maintenance cards (tasks / parts / items) about individual vehicle.
   - Each user can only see his/her vehicles' maintenance cards.
   - Each card should contain:
     - type (task, part, item)
     - name
     - description (optional, can be empty string)
     - interval mileage (in `km` or `mile`)
     - interval time (in `month`)

4. User should be able to update the vehicle milage.
   - When first click on the specific vehicle info / maintenance cards on the day.

### System behaviours

1. System should auto refresh the remaining mileage on the UI for individual maintenance card according to the related vehicle mileage.

## Basic Non-Functional Requirements

1. For MVP, make it to be a web-app, so user can access from any device.
