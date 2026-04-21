"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { addMinutes, format } from "date-fns"
import { after } from "next/server"
import { getServicesForBooking, getSalonConfig } from "./appointments"
import { CreateCheckoutSessionData } from "@/lib/interfaces"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"

export async function createCheckoutSession(data: CreateCheckoutSessionData) {
  try {
    const session = await auth()

    if (!data.staffId || !data.serviceIds.length || !data.startTime) {
      return { success: false, error: "Missing required fields" }
    }

    if (!session?.user && (!data.guestName || !data.guestEmail)) {
      return { success: false, error: "Customer information is required" }
    }

    const services = await getServicesForBooking(data.serviceIds)
    if (!services.length) {
      return { success: false, error: "Invalid service selection" }
    }

    const config = await getSalonConfig()

    const serviceNames = services.map((s) => s.name).join(", ")
    const customerName = session?.user?.name || data.guestName || "Customer"

    const startTime = new Date(data.startTime)

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
    const totalPrice = services.reduce(
      (sum, s) => sum + s.price.toNumber(),
      0
    )

    const endTime = addMinutes(startTime, totalDuration)

    // CREATE CUSTOMER (if needed)
    let customerId: string | null = null

    const user = session?.user
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          include: { customer: true },
        })
      : null

    if (user?.customer) {
      customerId = user.customer.id
    } else if (user) {
      const customer = await prisma.customer.create({
        data: {
          name: user.name || "Customer",
          email: user.email,
          userId: user.id,
        },
      })
      customerId = customer.id
    } else if (data.guestEmail) {
      const customer = await prisma.customer.create({
        data: {
          name: data.guestName || "Guest",
          email: data.guestEmail,
          phone: data.guestPhone,
        },
      })
      customerId = customer.id
    }

    const staff = await prisma.staff.findUnique({
      where: { id: data.staffId },
      select: { name: true },
    })

    // CREATE APPOINTMENT DIRECTLY (NO PAYMENT)
    const appointment = await prisma.appointment.create({
      data: {
        staffId: data.staffId,
        customerId,
        guestName: !customerId ? data.guestName : null,
        guestEmail: !customerId ? data.guestEmail : null,
        guestPhone: !customerId ? data.guestPhone : null,
        startTime,
        endTime,
        status: "CONFIRMED",
        notes: data.notes,
        totalPrice,
        depositAmount: config.bookingDeposit,
        depositPaid: true,
        stripePaymentId: null,
        services: {
          create: data.serviceIds.map((serviceId: string) => ({
            serviceId,
          })),
        },
      },
    })

    const customerEmail = data.guestEmail || session?.user?.email

    if (customerEmail) {
      after(async () => {
        await sendAppointmentConfirmationEmail({
          email: customerEmail,
          customerName,
          serviceName: serviceNames,
          staffName: staff?.name || "Our Staff",
          appointmentDate: startTime,
          appointmentTime: format(startTime, "h:mm a"),
          duration: totalDuration,
          totalPrice,
          depositAmount: config.bookingDeposit,
          appointmentId: appointment.id,
        })
      })
    }

    return {
      success: true,
      appointmentId: appointment.id,
    }
  } catch (error) {
    console.error("Appointment error:", error)
    return {
      success: false,
      error: "Failed to create appointment",
    }
  }
}

// KEEP FUNCTION NAME FOR COMPATIBILITY (NO STRIPE)
export async function verifyAndCreateAppointment() {
  return {
    success: true,
    message: "Stripe disabled - appointments are created directly",
  }
}

// DISABLED FUNCTION (NO STRIPE)
export async function createDepositCheckoutForAppointment() {
  return {
    success: false,
    error: "Payments disabled in this version",
  }
}