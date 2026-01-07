export const EventTypes =    {  
    OrderCreated: "OrderCreated",
    OrderFulfilled: "OrderFulfilled"
};

export type EventTypes = typeof EventTypes[keyof typeof EventTypes];
