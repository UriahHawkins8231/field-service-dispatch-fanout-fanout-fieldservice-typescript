import { dispatchWorkOrder } from "../src/dispatch_work_order.js";

const result = await dispatchWorkOrder({
  workOrderId: "wo-1842",
  dispatchStatus: "en_route",
  technician: { id: "tech-17", name: "Maya Chen" },
  photos: [
    {
      photoId: "photo-1",
      objectKey: "work-orders/wo-1842/front-panel.jpg",
      caption: "Front panel before repair",
    },
  ],
  subscribers: [
    { subscriberId: "customer-91", channel: "sms", notificationsEnabled: true },
    { subscriberId: "dispatcher-4", channel: "push", notificationsEnabled: true },
  ],
  followUp: {
    cronExpr: "0 17 * * *",
    taskUrl: "https://service.example.com/technician-follow-up",
  },
});

console.log(JSON.stringify(result, null, 2));
