import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { addMinutes, format } from "date-fns"
import { sendAppointmentConfirmationEmail } from "@/lib/email/appointment-confirmation"

export async function POST(req: Request) {
  try {
    const data = await req.json()

    const {
      serviceIds,
      staffId,
      startTime,
      guestName,
      guestEmail,
      guestPhone,
      notes,
      userId,
      customerName,
    } = data

    if (!serviceIds || !staffId || !startTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const start = new Date(startTime)

    // Get services
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, duration: true, price: true },
    })

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
    const totalPrice = services.reduce(
      (sum, s) => sum + s.price.toNumber(),
      0
    )

    const endTime = addMinutes(start, totalDuration)

    // Create or link customer
    let customerId: string | null = null

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { customer: true },
      })

      if (user?.customer) {
        customerId = user.customer.id
      } else if (user) {
        const customer = await prisma.customer.create({
          data: {
            name: customerName || "Customer",
            email: user.email,
            phone: guestPhone,
            userId,
          },
        })
        customerId = customer.id
      }
    }

    // Get staff
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { name: true },
    })

    // Create appointment (NO STRIPE)
    const appointment = await prisma.appointment.create({
      data: {
        staffId,
        customerId,
        guestName: !customerId ? guestName : null,
        guestEmail: !customerId ? guestEmail : null,
        guestPhone: !customerId ? guestPhone : null,
        startTime: start,
        endTime,
        status: "CONFIRMED",
        notes,
        totalPrice,
        depositAmount: 0,
        depositPaid: false,
        stripePaymentId: null,
        services: {
          create: serviceIds.map((serviceId: string) => ({
            serviceId,
          })),
        },
      },
    })

    // Send email if available
    const email = guestEmail

    if (email) {
      const serviceNames = services.map((s) => s.name).join(", ")

      await sendAppointmentConfirmationEmail({
        email,
        customerName: customerName || guestName || "Customer",
        serviceName: serviceNames,
        staffName: staff?.name || "Our Staff",
        appointmentDate: start,
        appointmentTime: format(start, "h:mm a"),
        duration: totalDuration,
        totalPrice,
        depositAmount: 0,
        appointmentId: appointment.id,
      })
    }

    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
    })
  } catch (error) {
    console.error("Appointment creation error:", error)

    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    )
  }
}