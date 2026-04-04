# Naming Conventions

## Environment Variables

- All environment variables are stored in 1 `.env` file at the project root folder @../../ .
- All frontend environment variables should have prefix `FRONTEND_`.
- Never using `NEXT_` prefix for environment variable. Because NextJS will fix the value at build time. All the environment variable in this project must have the flexibility at runtime.

# Component Convention

## Single responsibility

- Each file should only contain a component.
- Each component should only handle 1 responsibility. Eg:
  - `VehicleDisplay` component should only handle processing data and declare data processing functions. For example, consolidate data from the query and pass to `VehicleDisplayPresentation` for displaying on UI.
  - `VehicleDisplayPresentation` component should only handle UI rendering for the data passed in.
- Benefit of doing this is to make the components be easier to manage

### Example

```typescript
// vehicle-display.tsx

import { FC } from 'react';

// all path are just for example, not the actual location
import { useGetVehicle } from 'hooks/queries/';
import { VehicleDisplayPresentation } from './vehicle-display-presentation';

type VehicleDisplayProps = {
  vehicleId: string;
  // other props
};

export const VehicleDisplay: FC<VehicleDisplayProps> = ({
  vehicleId,
  // other props
}) => {
  // Getting data from query
  const { data: vehicle } = useGetVehicle({
    vehicleId,
  });
  const { mutation: deleteVehicleFn } = useDeleteVehicle();

  // Example of processing data
  const displayedVehicleId = vehicle.id ?? '';

  // Example of function declaring for processing data
  const deleteVehicle = (vehicleId: string) => {
    deleteVehicleFn(vehicleId)
  }

  return <VehicleDisplayPresentation vehicle={vehicle} vehicleId={displayedVehicleId} onDeleteVehicle={deleteVehicle} />;
};
```

```typescript
// vehicle-display-presentation.tsx

import { FC } from 'react';

// all path are just for example, not the actual location
import { IVehicleData } from 'types/vehicle-data.type';

type VehicleDisplayPresentationProps = {
  vehicle: IVehicleData;
  displayedVehicleId: string;
  onDeleteVehicle: (vehicleId: string) => void
  // other props
};

export const VehicleDisplayPresentation: FC<
  VehicleDisplayPresentationProps
> = ({ vehicle, displayedVehicleId, onDeleteVehicle }) => {
  return (
    <>
      <div>
        {displayedVehicleId}
      </div>
      <div>
        {vehicle.model}
      </div>
      <button onClick={onDeleteVehicle}>Delete</button>
      {/* Other JSX code */}
    </>
  )
};
```

## Syntax Convention

### Arrow Function

Avoid declaring function with keyword `function`, declaring as `arrow function` instead.
Only use keyword `function` when really required to hoist at the global.

```typescript
// Never do this
function myFunction(name: string) {
  // function code
}

// Do this
const myFunction = (name: string) => {
  // function code
};
```

### Make use of `FC` type

For making maintenance easier, use `FC` (from react) instead when creating of component.

```typescript
type VehicleDisplayProps = {
  vehicleId: string;
  // other props
};

// Never do this
const VehicleDisplay = ({ vehicleId }: VehicleDisplayProps) => {
  // Component code
};

// Do this instead
const VehicleDisplay: FC<VehicleDisplayProps> = ({ vehicleId }) => {
  // Component code
};
```

### `page.tsx` responsibility

`page.tsx` must only contain logic of the routing / redirecting. The rendering and action logic should be defined in page components in @./frontend/src/components/ .

Example of `page.tsx`:

```ts
import { NextPage } from 'next';
import { VehiclePage as VehiclePageComponent } from '@/components/pages/vehicle-page';

const VehiclePage: NextPage = () => {
  const user = useUser();

  // if user is not logged in, redirect to auth page
  if (!user) {
    // logic of redirecting to auth page
  }

  return <VehiclePageComponent />;
}

export default VehiclePage;
```
